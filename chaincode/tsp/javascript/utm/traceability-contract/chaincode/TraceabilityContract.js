'use strict';
const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

/**
 * Smart contract for managing product traceability data with integration to quality assurance.
 */
class TraceabilityContract extends Contract {
    constructor() {
        super('utm.TraceabilityContract');
        this.configCache = null;
        console.debug('TraceabilityContract initialized');
    }

    /**
     * Initializes the traceability configuration.
     * @param {Context} ctx - The transaction context.
     * @returns {Promise<void>}
     */
    async initLedger(ctx) {
        console.debug('Starting initLedger');
        // if (!ctx.clientIdentity.getAttributeValue('admin')) {
        //     throw new Error('Only admins can initialize the ledger');
        // }

        const configBytes = await ctx.stub.getState('traceabilityConfig');
        if (configBytes && configBytes.length > 0) {
            throw new Error('Traceability configuration already initialized');
        }

        const config = {
            issuer: '/C=US/ST=California/O=QA-CA',
            retentionDays: 30,
            supportedProducts: ['honey', 'olive_oil']
        };

        try {
            await ctx.stub.putState('traceabilityConfig', Buffer.from(JSON.stringify(config)));
            ctx.stub.setEvent('ConfigInitialized', Buffer.from(JSON.stringify({
                eventType: 'ConfigInitialized',
                timestamp: new Date().toISOString(),
                txId: ctx.stub.getTxID()
            })));
            console.debug('Traceability configuration initialized');
        } catch (err) {
            console.error(`Failed to initialize configuration: ${err.message}`);
            throw new Error(`Failed to initialize configuration: ${err.message}`);
        }
    }

    /**
     * Records traceability data for a product phase.
     * @param {Context} ctx - The transaction context.
     * @param {string} productId - The product identifier.
     * @param {string} productType - The product type (e.g., honey, olive_oil).
     * @param {string} phase - The production phase.
     * @param {string} traceDataJSON - JSON string of traceability data.
     * @returns {Promise<string>} Success message.
     */
    async recordTraceabilityData(ctx, productId, productType, phase, traceDataJSON) {
        console.debug(`recordTraceabilityData called with productId: ${productId}, productType: ${productType}, phase: ${phase}, txId: ${ctx.stub.getTxID()}`);
        
        if (!this._validateId(productId) || !this._validateId(productType) || !this._validateId(phase)) {
            throw new Error('productId, productType, and phase must be non-empty alphanumeric strings');
        }

        const config = await this._getConfig(ctx);
        if (!config.supportedProducts.includes(productType)) {
            throw new Error(`Unsupported productType: ${productType}. Supported: ${config.supportedProducts.join(', ')}`);
        }

        const validPhases = await this._getValidPhases(ctx, productType);
        if (!validPhases.includes(phase)) {
            throw new Error(`Invalid phase for ${productType}: ${phase}. Valid phases: ${validPhases.join(', ')}`);
        }

        let traceData;
        try {
            traceData = JSON.parse(traceDataJSON);
            if (!traceData || typeof traceData !== 'object') {
                throw new Error('Invalid traceability data');
            }
        } catch (err) {
            throw new Error(`Failed to parse traceDataJSON: ${err.message}`);
        }

        const dataKey = `${productId}_${phase}`;
        const collection = `traceability-channel`;
        try {
            await ctx.stub.putPrivateData(collection, dataKey, Buffer.from(JSON.stringify(traceData)));
            const dataHash = crypto.createHash('sha256').update(JSON.stringify(traceData)).digest('hex');
            await this._publishToPublicChannel(ctx, 'recordTraceability', { productId, productType, phase, dataHash });
            ctx.stub.setEvent('TraceabilityRecorded', Buffer.from(JSON.stringify({
                eventType: 'TraceabilityRecorded',
                productId,
                productType,
                phase,
                dataHash,
                timestamp: new Date().toISOString(),
                txId: ctx.stub.getTxID()
            })));
            console.debug(`Traceability data recorded: ${dataKey}`);
            return `Traceability data for ${productId}/${phase} recorded successfully`;
        } catch (err) {
            console.error(`Failed to record traceability data: ${err.message}`);
            throw new Error(`Failed to record traceability data: ${err.message}`);
        }
    }

    /**
     * Reads traceability data for a product phase if a valid VCA is provided.
     * @param {Context} ctx - The transaction context.
     * @param {string} productId - The product identifier.
     * @param {string} phase - The production phase.
     * @param {string} verifiableCredentialAccess - JSON string of VCA.
     * @returns {Promise<object>} Traceability data.
     */
    async readTraceabilityData(ctx, productId, phase, verifiableCredentialAccess) {
        console.debug(`readTraceabilityData called with productId: ${productId}, phase: ${phase}, txId: ${ctx.stub.getTxID()}`);
        
        if (!this._validateId(productId) || !this._validateId(phase)) {
            throw new Error('productId and phase must be non-empty alphanumeric strings');
        }

        const credentialValid = await this._verifyVerifiableCredentialAccess(ctx, verifiableCredentialAccess);
        if (!credentialValid) {
            throw new Error('Access denied: Invalid or expired Verifiable Credential Access');
        }

        const dataKey = `${productId}_${phase}`;
        const collection = `traceability-channel`;
        const dataBytes = await ctx.stub.getPrivateData(collection, dataKey);
        if (!dataBytes || dataBytes.length === 0) {
            throw new Error(`Traceability data for ${productId}/${phase} not found`);
        }

        try {
            const traceData = JSON.parse(dataBytes.toString());
            console.debug(`Traceability data retrieved: ${dataKey}`);
            return traceData;
        } catch (err) {
            console.error(`Failed to parse traceability data: ${err.message}`);
            throw new Error(`Failed to parse traceability data: ${err.message}`);
        }
    }

    /**
     * Verifies compliance of traceability data against phase-specific standards.
     * @param {Context} ctx - The transaction context.
     * @param {string} productId - The product identifier.
     * @param {string} productType - The product type.
     * @param {string} phase - The production phase.
     * @returns {Promise<object>} Compliance report.
     */
    async verifyCompliance(ctx, productId, productType, phase) {
        console.debug(`verifyCompliance called with productId: ${productId}, productType: ${productType}, phase: ${phase}, txId: ${ctx.stub.getTxID()}`);
        
        if (!this._validateId(productId) || !this._validateId(productType) || !this._validateId(phase)) {
            throw new Error('productId, productType, and phase must be non-empty alphanumeric strings');
        }

        const config = await this._getConfig(ctx);
        if (!config.supportedProducts.includes(productType)) {
            throw new Error(`Unsupported productType: ${productType}. Supported: ${config.supportedProducts.join(', ')}`);
        }

        const validPhases = await this._getValidPhases(ctx, productType);
        if (!validPhases.includes(phase)) {
            throw new Error(`Invalid phase for ${productType}: ${phase}. Valid phases: ${validPhases.join(', ')}`);
        }

        const traceData = await this.readTraceabilityData(ctx, productId, phase, JSON.stringify({ credentialId: 'system' }));
        const standard = await this._getStandard(ctx, productType, phase);
        const report = this._validateParameters(traceData, standard, phase, productType);

        try {
            await this._publishToPublicChannel(ctx, 'recordCompliance', { productId, productType, phase, report });
            ctx.stub.setEvent('ComplianceVerified', Buffer.from(JSON.stringify({
                eventType: 'ComplianceVerified',
                productId,
                productType,
                phase,
                compliant: report.compliant,
                timestamp: new Date().toISOString(),
                txId: ctx.stub.getTxID()
            })));
            console.debug(`Compliance report recorded: ${productId}/${phase}`);
        } catch (err) {
            console.error(`Failed to record compliance report: ${err.message}`);
            throw new Error(`Failed to record compliance report: ${err.message}`);
        }

        return report;
    }

    /**
     * Issues a quality certificate as a Verifiable Credential.
     * @param {Context} ctx - The transaction context.
     * @param {string} productId - The product identifier.
     * @param {string} productType - The product type.
     * @param {string} certificateId - The certificate identifier.
     * @returns {Promise<object>} Verifiable Credential.
     */
    async issueQualityCertificate(ctx, productId, productType, certificateId) {
        console.debug(`issueQualityCertificate called with productId: ${productId}, productType: ${productType}, certificateId: ${certificateId}, txId: ${ctx.stub.getTxID()}`);
        
        if (!this._validateId(productId) || !this._validateId(productType) || !this._validateId(certificateId)) {
            throw new Error('productId, productType, and certificateId must be non-empty alphanumeric strings');
        }

        await this._verifyQAIdentity(ctx, 'certification');
        const config = await this._getConfig(ctx);
        if (!config.supportedProducts.includes(productType)) {
            throw new Error(`Unsupported productType: ${productType}. Supported: ${config.supportedProducts.join(', ')}`);
        }

        const validPhases = await this._getValidPhases(ctx, productType);
        const phaseResults = {};
        for (const phase of validPhases) {
            const result = await this.verifyCompliance(ctx, productId, productType, phase);
            phaseResults[phase] = result;
            if (!result.compliant) {
                throw new Error(`Certification failed: ${phase} phase non-compliant`);
            }
        }

        const vc = await this._generateQualityCertificate(ctx, productId, productType, certificateId, phaseResults);
        try {
            await ctx.stub.putPrivateData('product-channel', certificateId, Buffer.from(JSON.stringify(vc)));
            await this._publishToPublicChannel(ctx, 'recordCertification', { certificateId, productId, productType, vc });
            ctx.stub.setEvent('CertificateIssued', Buffer.from(JSON.stringify({
                eventType: 'CertificateIssued',
                certificateId,
                productId,
                productType,
                timestamp: vc.issuanceDate,
                txId: ctx.stub.getTxID()
            })));
            console.debug(`Quality certificate issued: ${certificateId}`);
            return vc;
        } catch (err) {
            console.error(`Failed to issue certificate: ${err.message}`);
            throw new Error(`Failed to issue certificate: ${err.message}`);
        }
    }

    /**
     * Requests a Verifiable Credential Access.
     * @param {Context} ctx - The transaction context.
     * @param {string} actorId - The requesting actor's ID.
     * @param {string} credentialId - The credential identifier.
     * @param {string} expiryDate - ISO expiry date.
     * @returns {Promise<string>} Success message.
     */
    async requestVerifiableCredentialAccess(ctx, actorId, credentialId, expiryDate) {
        console.debug(`requestVerifiableCredentialAccess called with actorId: ${actorId}, credentialId: ${credentialId}, txId: ${ctx.stub.getTxID()}`);
        
        if (!this._validateId(actorId) || !this._validateId(credentialId)) {
            throw new Error('actorId and credentialId must be non-empty alphanumeric strings');
        }

        if (!this._validateISODate(expiryDate)) {
            throw new Error('expiryDate must be a valid ISO date');
        }

        await this._verifyQAIdentity(ctx, 'access');
        const config = await this._getConfig(ctx);
        const credential = {
            credentialId,
            actorId,
            grantedTo: config.issuer,
            issuer: config.issuer,
            expiryDate,
            timestamp: new Date().toISOString(),
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential', 'AccessCredential']
        };

        credential.proof = await this._signVC(ctx, credential);

        try {
            await ctx.stub.putState(credentialId, Buffer.from(JSON.stringify(credential)));
            ctx.stub.setEvent('AccessCredentialIssued', Buffer.from(JSON.stringify({
                eventType: 'AccessCredentialIssued',
                credentialId,
                actorId,
                timestamp: credential.timestamp,
                txId: ctx.stub.getTxID()
            })));
            console.debug(`Access credential issued: ${credentialId}`);
            return `Verifiable Credential Access ${credentialId} issued to ${config.issuer}`;
        } catch (err) {
            console.error(`Failed to issue access credential: ${err.message}`);
            throw new Error(`Failed to issue access credential: ${err.message}`);
        }
    }

    /**
     * Revokes a Verifiable Credential Access.
     * @param {Context} ctx - The transaction context.
     * @param {string} credentialId - The credential identifier.
     * @returns {Promise<string>} Success message.
     */
    async revokeVerifiableCredentialAccess(ctx, credentialId) {
        console.debug(`revokeVerifiableCredentialAccess called with credentialId: ${credentialId}, txId: ${ctx.stub.getTxID()}`);
        
        if (!this._validateId(credentialId)) {
            throw new Error('credentialId must be a non-empty alphanumeric string');
        }

        await this._verifyQAIdentity(ctx, 'access');
        const credentialBytes = await ctx.stub.getState(credentialId);
        if (!credentialBytes || credentialBytes.length === 0) {
            throw new Error(`Access credential ${credentialId} not found`);
        }

        try {
            await ctx.stub.deleteState(credentialId);
            await this._publishToPublicChannel(ctx, 'recordRevocation', { credentialId, type: 'AccessCredential' });
            ctx.stub.setEvent('AccessCredentialRevoked', Buffer.from(JSON.stringify({
                eventType: 'AccessCredentialRevoked',
                credentialId,
                timestamp: new Date().toISOString(),
                txId: ctx.stub.getTxID()
            })));
            console.debug(`Access credential revoked: ${credentialId}`);
            return `Verifiable Credential Access ${credentialId} revoked`;
        } catch (err) {
            console.error(`Failed to revoke access credential: ${err.message}`);
            throw new Error(`Failed to revoke access credential: ${err.message}`);
        }
    }

    /**
     * Updates configuration parameters.
     * @param {Context} ctx - The transaction context.
     * @param {string} configJSON - JSON string of configuration updates.
     * @returns {Promise<object>} Updated configuration.
     */
    async updateConfig(ctx, configJSON) {
        console.debug(`updateConfig called, txId: ${ctx.stub.getTxID()}`);
        if (!ctx.clientIdentity.getAttributeValue('admin')) {
            throw new Error('Only admins can update configuration');
        }

        let configUpdates;
        try {
            configUpdates = JSON.parse(configJSON);
        } catch (err) {
            throw new Error(`Invalid config JSON: ${err.message}`);
        }

        const config = await this._getConfig(ctx);
        if (configUpdates.issuer) {
            if (typeof configUpdates.issuer !== 'string') {
                throw new Error('Issuer must be a string');
            }
            config.issuer = configUpdates.issuer;
        }
        if (configUpdates.retentionDays) {
            if (typeof configUpdates.retentionDays !== 'number' || configUpdates.retentionDays < 1) {
                throw new Error('retentionDays must be a positive number');
            }
            config.retentionDays = configUpdates.retentionDays;
        }
        if (configUpdates.supportedProducts) {
            if (!Array.isArray(configUpdates.supportedProducts) || !configUpdates.supportedProducts.every(p => this._validateId(p))) {
                throw new Error('supportedProducts must be an array of alphanumeric strings');
            }
            config.supportedProducts = configUpdates.supportedProducts;
        }

        try {
            await ctx.stub.putState('traceabilityConfig', Buffer.from(JSON.stringify(config)));
            ctx.stub.setEvent('ConfigUpdated', Buffer.from(JSON.stringify({
                eventType: 'ConfigUpdated',
                timestamp: new Date().toISOString(),
                txId: ctx.stub.getTxID()
            })));
            console.debug('Configuration updated successfully');
            return { status: 'SUCCESS', config };
        } catch (err) {
            console.error(`Failed to update configuration: ${err.message}`);
            throw new Error(`Failed to update configuration: ${err.message}`);
        }
    }

    /**
     * Validates an ID (alphanumeric with underscores or hyphens).
     * @param {string} id - The ID to validate.
     * @returns {boolean} True if valid.
     */
    _validateId(id) {
        return typeof id === 'string' && id.match(/^[a-zA-Z0-9_-]+$/);
    }

    /**
     * Validates an ISO date string.
     * @param {string} date - The date to validate.
     * @returns {boolean} True if valid.
     */
    _validateISODate(date) {
        try {
            const parsed = new Date(date);
            return parsed.toISOString() === date;
        } catch {
            return false;
        }
    }

    /**
     * Retrieves configuration.
     * @param {Context} ctx - The transaction context.
     * @returns {Promise<object>} Configuration.
     */
    async _getConfig(ctx) {
        console.debug(`Fetching config, txId: ${ctx.stub.getTxID()}`);
        if (this.configCache) {
            return this.configCache;
        }

        const configBytes = await ctx.stub.getState('traceabilityConfig');
        if (!configBytes || configBytes.length === 0) {
            throw new Error('Configuration not initialized');
        }

        try {
            const config = JSON.parse(configBytes.toString());
            this.configCache = config;
            console.debug('Config retrieved');
            return config;
        } catch (err) {
            console.error(`Failed to parse config: ${err.message}`);
            throw new Error(`Failed to parse config: ${err.message}`);
        }
    }

    /**
     * Retrieves valid phases for a product type from GenericQualityAssuranceContract.
     * @param {Context} ctx - The transaction context.
     * @param {string} productType - The product type.
     * @returns {Promise<string[]>} Array of valid phases.
     */
    async _getValidPhases(ctx, productType) {
        console.debug(`Fetching valid phases for ${productType}, txId: ${ctx.stub.getTxID()}`);
        try {
            const response = await ctx.stub.invokeChaincode(
                'GenericQualityAssuranceContract',
                ['getConfig'],
                'standards-channel'
            );
            if (response.status !== 200) {
                throw new Error(`Failed to fetch config: ${response.message}`);
            }
            const config = JSON.parse(response.payload.toString());
            const phases = config.phases[productType] || [];
            if (!phases.length) {
                throw new Error(`No phases defined for ${productType}`);
            }
            return phases;
        } catch (err) {
            console.error(`Failed to fetch valid phases: ${err.message}`);
            throw new Error(`Failed to fetch valid phases: ${err.message}`);
        }
    }

    /**
     * Retrieves a standard from HoneyStandardsContract.
     * @param {Context} ctx - The transaction context.
     * @param {string} productType - The product type.
     * @param {string} phase - The production phase.
     * @returns {Promise<object>} Standard.
     */
    async _getStandard(ctx, productType, phase) {
        console.debug(`Fetching standard for ${productType}/${phase}, txId: ${ctx.stub.getTxID()}`);
        try {
            const response = await ctx.stub.invokeChaincode(
                'HoneyStandardsContract',
                ['getPhaseStandard', productType, phase],
                'standards-channel'
            );
            if (response.status !== 200) {
                throw new Error(`Failed to fetch standard: ${response.message}`);
            }
            const standard = JSON.parse(response.payload.toString());
            if (!standard || typeof standard !== 'object') {
                throw new Error('Invalid standard structure');
            }
            console.debug(`Standard retrieved: ${productType}/${phase}`);
            return standard;
        } catch (err) {
            console.error(`Failed to fetch standard: ${err.message}`);
            throw new Error(`Failed to fetch standard: ${err.message}`);
        }
    }

    /**
     * Validates traceability data against a standard.
     * @param {object} data - Traceability data.
     * @param {object} standard - Standard to validate against.
     * @param {string} phase - The production phase.
     * @param {string} productType - The product type.
     * @returns {object} Compliance report.
     */
    _validateParameters(data, standard, phase, productType) {
        console.debug(`Validating parameters for ${productType}/${phase}, txId: ${this.ctx?.stub.getTxID() || 'unknown'}`);
        if (!data || typeof data !== 'object' || !standard || typeof standard !== 'object') {
            throw new Error('Invalid data or standard');
        }

        const violations = [];
        const validateNested = (data, standard, prefix = '') => {
            for (const [param, value] of Object.entries(data)) {
                if (param === 'productId' || param === 'timestamp') continue;
                const std = standard[param];
                if (!std) {
                    violations.push({ parameter: `${prefix}${param}`, issue: 'Unknown parameter' });
                    continue;
                }
                if (typeof std === 'object' && !std.min && !std.max && !std.required) {
                    validateNested(value, std, `${prefix}${param}.`);
                    continue;
                }
                if (std.required && (value === undefined || value === null)) {
                    violations.push({ parameter: `${prefix}${param}`, issue: 'Required parameter missing' });
                    continue;
                }
                if (std.min && typeof value === 'number' && value < std.min) {
                    violations.push({ parameter: `${prefix}${param}`, issue: `Value ${value} below min ${std.min}` });
                }
                if (std.max && typeof value === 'number' && value > std.max) {
                    violations.push({ parameter: `${prefix}${param}`, issue: `Value ${value} above max ${std.max}` });
                }
            }
        };

        validateNested(data, standard);
        const compliant = violations.length === 0;
        const report = {
            productId: data.productId || 'unknown',
            productType,
            phase,
            compliant,
            violations,
            timestamp: new Date().toISOString()
        };
        console.debug(`Validation result: ${JSON.stringify(report)}`);
        return report;
    }

    /**
     * Generates a quality certificate as a Verifiable Credential.
     * @param {Context} ctx - The transaction context.
     * @param {string} productId - The product identifier.
     * @param {string} productType - The product type.
     * @param {string} certificateId - The certificate identifier.
     * @param {object} phaseResults - Compliance results for phases.
     * @returns {Promise<object>} Verifiable Credential.
     */
    async _generateQualityCertificate(ctx, productId, productType, certificateId, phaseResults) {
        console.debug(`Generating certificate for ${productId}, txId: ${ctx.stub.getTxID()}`);
        const config = await this._getConfig(ctx);
        const qaConfig = await this._getQAConfig(ctx);
        const expiryDays = qaConfig.expiry[productType] || qaConfig.expiry.default;
        const issueDate = new Date().toISOString();
        const issuerDid = `did:web:certverify.example.com:${ctx.clientIdentity.getMSPID()}:${ctx.clientIdentity.getID()}`;

        const vc = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                qaConfig.schema
            ],
            id: certificateId,
            type: ['VerifiableCredential', 'QualityCertificate'],
            issuer: issuerDid,
            issuanceDate: issueDate,
            expirationDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
            credentialSubject: {
                id: `did:web:certverify.example.com:product:${productId}`,
                productId,
                productType,
                compliance: phaseResults
            },
            credentialStatus: {
                id: 'https://certverify.example.com/revocations#list1',
                type: 'RevocationList2020'
            },
            qrCode: `https://certverify.example.com/${certificateId}`,
            metadata: {
                blockchain: 'product-channel',
                txId: ctx.stub.getTxID()
            }
        };

        vc.proof = await this._signVC(ctx, vc);
        return vc;
    }

    /**
     * Signs a Verifiable Credential.
     * @param {Context} ctx - The transaction context.
     * @param {object} vc - The Verifiable Credential.
     * @returns {Promise<object>} Proof object.
     */
    async _signVC(ctx, vc) {
        console.debug(`Signing VC, txId: ${ctx.stub.getTxID()}`);
        const proof = {
            type: 'EcdsaSecp256k1Signature2019',
            created: new Date().toISOString(),
            proofPurpose: 'assertionMethod',
            verificationMethod: `${vc.issuer}#key-1`
        };
        const vcString = JSON.stringify(vc);
        const hash = crypto.createHash('sha256').update(vcString).digest('hex');
        proof.proofValue = `ecdsa:${hash}`; // Placeholder: Integrate with HSM
        return proof;
    }

    /**
     * Verifies a Verifiable Credential Access.
     * @param {Context} ctx - The transaction context.
     * @param {string} verifiableCredentialAccess - JSON string of VCA.
     * @returns {Promise<boolean>} True if valid.
     */
    async _verifyVerifiableCredentialAccess(ctx, verifiableCredentialAccess) {
        console.debug(`Verifying VCA, txId: ${ctx.stub.getTxID()}`);
        if (verifiableCredentialAccess === JSON.stringify({ credentialId: 'system' })) {
            await this._verifyQAIdentity(ctx, 'verification');
            return true;
        }

        let credential;
        try {
            credential = JSON.parse(verifiableCredentialAccess);
            if (!credential.credentialId || !credential.issuer || !credential.expiryDate) {
                return false;
            }
        } catch (err) {
            console.error(`Failed to parse VCA: ${err.message}`);
            return false;
        }

        const credentialBytes = await ctx.stub.getState(credential.credentialId);
        if (!credentialBytes || credentialBytes.length === 0) {
            return false;
        }

        let storedCredential;
        try {
            storedCredential = JSON.parse(credentialBytes.toString());
        } catch (err) {
            console.error(`Failed to parse stored credential: ${err.message}`);
            return false;
        }

        const config = await this._getConfig(ctx);
        if (storedCredential.issuer !== config.issuer) {
            return false;
        }

        const currentTime = new Date().toISOString();
        if (storedCredential.expiryDate < currentTime) {
            return false;
        }

        // Placeholder: Verify proof (requires HSM integration)
        if (!storedCredential.proof || storedCredential.proof.proofValue === 'ecdsa:placeholder') {
            console.warn('Proof verification skipped: Placeholder proof');
        }

        try {
            const response = await ctx.stub.invokeChaincode(
                'PublicCertificationContract',
                ['getRevocation', credential.credentialId],
                'public-cert-channel'
            );
            if (response.status === 200) {
                const revocation = JSON.parse(response.payload.toString());
                if (revocation.status !== 'NOT_REVOKED') {
                    return false;
                }
            }
        } catch (err) {
            console.warn(`Failed to check revocation: ${err.message}`);
        }

        return true;
    }

    /**
     * Verifies QA identity and privileges.
     * @param {Context} ctx - The transaction context.
     * @param {string} requiredPrivilege - Required privilege.
     * @returns {Promise<void>}
     */
    async _verifyQAIdentity(ctx, requiredPrivilege) {
        console.debug(`Verifying QA identity for ${requiredPrivilege}, txId: ${ctx.stub.getTxID()}`);
        const certPEM = ctx.clientIdentity.getX509Certificate();
        if (!certPEM) {
            throw new Error('No X.509 certificate provided');
        }

        let cert;
        try {
            cert = new crypto.X509Certificate(certPEM);
        } catch (err) {
            throw new Error(`Failed to parse X.509 certificate: ${err.message}`);
        }

        if (cert.validTo < new Date().toISOString()) {
            throw new Error('QA certificate expired');
        }

        const config = await this._getConfig(ctx);
        if (!cert.issuer.includes(config.issuer)) {
            throw new Error('Untrusted QA certificate issuer');
        }

        try {
            const response = await ctx.stub.invokeChaincode(
                'GenericQualityAssuranceContract',
                ['getQARegistry'],
                'standards-channel'
            );
            if (response.status !== 200) {
                throw new Error(`Failed to fetch QA registry: ${response.message}`);
            }
            const qaRegistry = JSON.parse(response.payload.toString());
            const validator = qaRegistry.validators.find(v => certPEM.includes(v.cert));
            if (!validator) {
                throw new Error('Unauthorized QA validator');
            }
            if (requiredPrivilege && !validator.privileges.includes(requiredPrivilege)) {
                throw new Error(`QA validator lacks ${requiredPrivilege} privilege`);
            }
        } catch (err) {
            console.error(`Failed to verify QA identity: ${err.message}`);
            throw new Error(`Failed to verify QA identity: ${err.message}`);
        }
    }

    /**
     * Publishes data to the public channel.
     * @param {Context} ctx - The transaction context.
     * @param {string} method - The method to invoke.
     * @param {object} data - Data to publish.
     * @returns {Promise<void>}
     */
    async _publishToPublicChannel(ctx, method, data) {
        console.debug(`Publishing to public channel: ${method}, txId: ${ctx.stub.getTxID()}`);
        try {
            const response = await ctx.stub.invokeChaincode(
                'PublicCertificationContract',
                [method, JSON.stringify(data)],
                'public-cert-channel'
            );
            if (response.status !== 200) {
                throw new Error(`Chaincode invocation failed: ${response.message}`);
            }
            console.debug(`Published to public channel: ${method}`);
        } catch (err) {
            console.error(`Failed to publish to public channel: ${err.message}`);
            throw new Error(`Failed to publish to public channel: ${err.message}`);
        }
    }

    /**
     * Retrieves QA configuration from GenericQualityAssuranceContract.
     * @param {Context} ctx - The transaction context.
     * @returns {Promise<object>} QA configuration.
     */
    async _getQAConfig(ctx) {
        console.debug(`Fetching QA config, txId: ${ctx.stub.getTxID()}`);
        try {
            const response = await ctx.stub.invokeChaincode(
                'GenericQualityAssuranceContract',
                ['getConfig'],
                'standards-channel'
            );
            if (response.status !== 200) {
                throw new Error(`Failed to fetch QA config: ${response.message}`);
            }
            const config = JSON.parse(response.payload.toString());
            console.debug('QA config retrieved');
            return config;
        } catch (err) {
            console.error(`Failed to fetch QA config: ${err.message}`);
            throw new Error(`Failed to fetch QA config: ${err.message}`);
        }
    }
}

module.exports = TraceabilityContract;