/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../../../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../../../../test-application/javascript/AppUtil.js');

// Configurações
const channelName = 'mychannel';
const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'appUserHoneyStandards';

function prettyJSONString(inputString) {
    return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function main() {
    let gateway;
    let productContract;
    let honeyStandardContract;

    try {
        // Conexão com a rede Fabric
        console.log('Initializing Fabric connection...');

        const ccp = buildCCPOrg1();
        const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
        const wallet = await buildWallet(Wallets, walletPath);

        await enrollAdmin(caClient, wallet, mspOrg1);
        await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: org1UserId,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork(channelName);
        productContract = network.getContract('product');
        honeyStandardContract = network.getContract('standardhoney');

        console.log('Fabric connection successful. Contracts are ready.');

        // 1. Consultar todos os produtos de mel
        console.log('\nQuerying all honey products...');
        const allProducts = await productContract.evaluateTransaction('queryAllProducts');
        const products = JSON.parse(allProducts.toString());
        
        const honeyProducts = products.filter(p => p.productId.toLowerCase().includes('honey'));
        console.log(`${honeyProducts}`);

        if (honeyProducts.length === 0) {
            console.log('No honey products found in the ledger.');
            return;
        }

        console.log(`Found ${honeyProducts.length} honey product(s):`);
        //initialize the chaincode
        await honeyStandardContract.submitTransaction('init');
        
        // 2. Para cada produto de mel, verificar conformidade com os padrões
        for (const product of honeyProducts) {
            console.log(`\nChecking standards for product: ${product.productId}`);
            
            // Verificar se é um produto final (final_product)
            const isFinalProduct = product.properties.some(p => 
                p.propertyName === 'product_stage' && p.propertyValue === 'final_product');
            
            const phase = isFinalProduct ? 'final_product' : await determineProductPhase(product);
            
            try {
                // Obter os padrões para a fase do produto
                const standards = await honeyStandardContract.evaluateTransaction(
                    'getPhaseStandard', 
                    'honey', 
                    phase
                );
                
                const standardsObj = JSON.parse(standards.toString());
                console.log(`\nStandards for ${phase} phase:`);
                console.log(prettyJSONString(JSON.stringify(standardsObj)));
                
                // Verificar conformidade para cada propriedade
                const complianceResults = await checkCompliance(product, standardsObj);
                
                console.log(`\nCompliance results for ${product.productId}:`);
                console.table(complianceResults);
                
                // Gerar relatório resumido
                generateComplianceReport(product.productId, complianceResults);
                
            } catch (error) {
                console.error(`Error checking standards for ${product.productId}:`, error);
            }
        }

    } catch (error) {
        console.error(`******** FAILED to run application: ${error}`);
    } finally {
        if (gateway) {
            gateway.disconnect();
        }
    }
}

// Determina a fase do produto com base nas propriedades
async function determineProductPhase(product) {
    const stages = {
        'beekeeping': ['hive_health_score', 'pesticide_level'],
        'processing': ['moisture_content', 'temperature', 'filtration_quality'],
        'distribution': ['storage_temperature', 'humidity'],
        'retailing': ['packaging_integrity', 'storage_temperature']
    };
    
    for (const [phase, markers] of Object.entries(stages)) {
        if (markers.some(marker => 
            product.properties.some(p => p.propertyName === marker))) {
            return phase;
        }
    }
    
    return 'final_product'; // padrão se não puder determinar
}

// Verifica a conformidade das propriedades do produto com os padrões
async function checkCompliance(product, standards) {
    const results = [];
    
    for (const [propertyName, standard] of Object.entries(standards)) {
        const productProperty = product.properties.find(p => p.propertyName === propertyName);
        
        if (!productProperty) {
            results.push({
                property: propertyName,
                status: 'MISSING',
                value: 'N/A',
                standard: JSON.stringify(standard),
                message: 'Property not reported'
            });
            continue;
        }
        
        const value = parseFloat(productProperty.propertyValue);
        if (isNaN(value)) {
            // Para propriedades booleanas/não numéricas
            if (standard.required !== undefined) {
                results.push({
                    property: propertyName,
                    status: standard.required ? 'REQUIRED' : 'OPTIONAL',
                    value: productProperty.propertyValue,
                    standard: JSON.stringify(standard),
                    message: standard.required ? 'Verification required' : 'Optional property'
                });
            }
            continue;
        }
        
        // Verificação para propriedades numéricas
        let status = 'COMPLIANT';
        let message = '';
        
        if (standard.min !== undefined && value < standard.min) {
            status = 'NON-COMPLIANT';
            message = `Value below minimum (${standard.min}${standard.unit || ''})`;
        }
        
        if (standard.max !== undefined && value > standard.max) {
            status = 'NON-COMPLIANT';
            message = message 
                ? `${message} and above maximum (${standard.max}${standard.unit || ''})`
                : `Value above maximum (${standard.max}${standard.unit || ''})`;
        }
        
        results.push({
            property: propertyName,
            status,
            value: `${value}${standard.unit ? ' ' + standard.unit : ''}`,
            standard: `${standard.min !== undefined ? `min: ${standard.min}` : ''} ${
                standard.max !== undefined ? `max: ${standard.max}` : ''} ${
                standard.unit ? `unit: ${standard.unit}` : ''}`.trim(),
            message
        });
    }
    
    return results;
}

// Gera um relatório resumido de conformidade
function generateComplianceReport(productId, complianceResults) {
    const totalProperties = complianceResults.length;
    const compliantCount = complianceResults.filter(r => r.status === 'COMPLIANT').length;
    const nonCompliantCount = complianceResults.filter(r => r.status === 'NON-COMPLIANT').length;
    const missingCount = complianceResults.filter(r => r.status === 'MISSING').length;
    
    console.log(`\n=== Compliance Report for ${productId} ===`);
    console.log(`Total properties checked: ${totalProperties}`);
    console.log(`Compliant: ${compliantCount}`);
    console.log(`Non-compliant: ${nonCompliantCount}`);
    console.log(`Missing: ${missingCount}`);
    
    if (nonCompliantCount > 0) {
        console.log('\nNon-compliant properties:');
        complianceResults
            .filter(r => r.status === 'NON-COMPLIANT')
            .forEach(r => console.log(`- ${r.property}: ${r.message}`));
    }
    
    if (missingCount > 0) {
        console.log('\nMissing required properties:');
        complianceResults
            .filter(r => r.status === 'MISSING')
            .forEach(r => console.log(`- ${r.property}`));
    }
    
    const compliancePercentage = Math.round((compliantCount / totalProperties) * 100);
    console.log(`\nOverall compliance: ${compliancePercentage}%`);
}

main();