'use strict';
// Enforce strict mode for better error handling and to avoid undeclared variables
const { Contract } = require('fabric-contract-api');
// Import the Contract class from fabric-contract-api for Hyperledger Fabric chaincode development

// Define the QualityAssuranceContract class, extending Fabric's Contract class
class QualityAssuranceContract extends Contract {
    // Constructor to initialize the chaincode
    constructor() {
        // Call the parent constructor with the contract name
        super('utm.QualityAssuranceContract');
        // Initialize an in-memory cache for quality standards using a Map
        this.standardCache = new Map();
        // Define a list of authorized MSPs (Membership Service Providers) that can set standards
        this.standardAuthorities = ['StandardOrgMSP'];
    }

    // Sanitize input strings to prevent overly long or malformed inputs
    _sanitizeInput(input) {
        // Validate that the input is a string
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }
        // Set a maximum length for input to prevent abuse
        const maxLength = 256;
        if (input.length > maxLength) {
            throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
        }
        // Trim whitespace from the input and return it
        return input.trim();
    }

    // Validate the structure of a permissions object
    _validatePermissions(permissions) {
        // Ensure permissions is a non-null object
        if (!permissions || typeof permissions !== 'object') {
            throw new Error('Permissions must be an object');
        }
        // Check that read and write fields are boolean
        if (typeof permissions.read !== 'boolean' || typeof permissions.write !== 'boolean') {
            throw new Error('Permissions must contain read and write boolean fields');
        }
        // Define valid permission keys
        const validKeys = ['read', 'write'];
        // Get all keys from the permissions object
        const providedKeys = Object.keys(permissions);
        // Check for any invalid keys
        const invalidKeys = providedKeys.filter(key => !validKeys.includes(key));
        if (invalidKeys.length > 0) {
            throw new Error(`Invalid permissions fields: ${invalidKeys.join(', ')}`);
        }
    }

    // Log audit events to a private data collection for traceability
    async _logAudit(ctx, action, details) {
        // Generate a unique key for the audit log using the transaction ID
        const logKey = `AUDIT_${ctx.stub.getTxID()}`;
        // Get the transaction timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        // Create the audit log data object
        const logData = {
            action, // The action being logged (e.g., GrantAccess, CheckAccess_read)
            details, // Additional details about the action
            // Convert timestamp to ISO 8601 format with nanosecond precision
            timestamp: new Date(txTimestamp.seconds * 1000 + txTimestamp.nanos / 1000000).toISOString(),
            org: ctx.clientIdentity.getMSPID() // MSP ID of the calling organization
        };
        // Store the audit log in the 'AuditLog' private data collection
        await ctx.stub.putPrivateData('AuditLog', logKey, Buffer.from(JSON.stringify(logData)));
    }

    // Check if the calling organization has access to perform an operation on a batch
    async _checkAccessAuthorization(ctx, batchId, operation) {
        // Sanitize inputs to ensure they are valid strings
        batchId = this._sanitizeInput(batchId);
        operation = this._sanitizeInput(operation);
        // Validate that the operation is either 'read' or 'write'
        if (!['read', 'write'].includes(operation)) {
            throw new Error('Invalid operation type');
        }

        // Generate the access key using the caller's identity and batch ID
        const accessKey = `ACCESS_${ctx.clientIdentity.getID()}_${batchId}`;
        // Retrieve the access record from the ledger
        const accessBytes = await ctx.stub.getState(accessKey);

        // Check if the access record exists
        if (!accessBytes || accessBytes.length === 0) {
            throw new Error(`Quality organization not authorized to ${operation} data for batch ${batchId}`);
        }

        // Parse the access record
        const access = JSON.parse(accessBytes.toString());
        // Get the current transaction timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        // Convert to Date object with nanosecond precision
        const currentDate = new Date(txTimestamp.seconds * 1000 + txTimestamp.nanos / 1000000);
        // Convert the access expiry to a Date object
        const expiryDate = new Date(access.expiry);

        // Check if the operation is allowed and the access has not expired
        if (!access[operation] || expiryDate < currentDate) {
            throw new Error(`Authorization expired or insufficient privileges for ${operation}`);
        }

        // Log the successful access check
        await this._logAudit(ctx, `CheckAccess_${operation}`, { batchId, authorized: true });
        return access; // Return the access record
    }

    // Grant access to a quality organization for a specific batch
    async grantQualityAccess(ctx, qualityOrgId, batchId, permissions, expiry) {
        // Sanitize all input parameters
        qualityOrgId = this._sanitizeInput(qualityOrgId);
        batchId = this._sanitizeInput(batchId);
        this._validatePermissions(permissions); // Validate permissions structure
        expiry = this._sanitizeInput(expiry);

        // Validate that expiry is in ISO 8601 format
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expiry)) {
            throw new Error('Expiry must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)');
        }
        // Ensure expiry is in UTC
        if (!expiry.endsWith('Z')) {
            throw new Error('Expiry must be in UTC (end with Z)');
        }

        // Check if the batch exists
        const ownerKey = `OWNER_${batchId}`;
        const ownerBytes = await ctx.stub.getState(ownerKey);
        if (!ownerBytes || ownerBytes.length === 0) {
            throw new Error(`Batch ${batchId} does not exist`);
        }

        // Verify that the caller is the batch owner
        const productOwner = await this._getBatchOwner(ctx, batchId);
        if (ctx.clientIdentity.getID() !== productOwner) {
            throw new Error('Only product owner can grant access');
        }

        // Create the access record
        const accessKey = `ACCESS_${qualityOrgId}_${batchId}`;
        const txTimestamp = ctx.stub.getTxTimestamp();
        const accessRecord = {
            batchId,
            qualityOrgId,
            permissions,
            grantedBy: ctx.clientIdentity.getID(), // Record the grantor's identity
            // Record the grant timestamp with nanosecond precision
            grantDate: new Date(txTimestamp.seconds * 1000 + txTimestamp.nanos / 1000000).toISOString(),
            expiry
        };

        // Store the access record on the ledger
        await ctx.stub.putState(accessKey, Buffer.from(JSON.stringify(accessRecord)));
        // Emit an event to notify listeners of the access grant
        ctx.stub.setEvent('AccessGranted', Buffer.from(JSON.stringify(accessRecord)));
        // Log the access grant action
        await this._logAudit(ctx, 'GrantAccess', { batchId, qualityOrgId, permissions });
    }

    // Retrieve private traceability data for a batch and phase
    async _getPrivateData(ctx, batchId, phase) {
        // Sanitize inputs
        batchId = this._sanitizeInput(batchId);
        phase = this._sanitizeInput(phase);

        // Define the private data collection name based on the caller's MSP ID
        const collection = `PrivateData_${ctx.clientIdentity.getMSPID()}`;
        // Generate the data key for the traceability data
        const dataKey = `TRACE_${batchId}_${phase}`;
        // Retrieve the data from the private collection
        const dataBytes = await ctx.stub.getPrivateData(collection, dataKey);

        // Check if the data exists
        if (!dataBytes || dataBytes.length === 0) {
            throw new Error(`Traceability data not found for batch ${batchId} and phase ${phase}`);
        }

        // Parse and validate the traceability data
        try {
            const data = JSON.parse(dataBytes.toString());
            // Ensure required fields are present
            if (!data.batchId || !data.productType) {
                throw new Error('Invalid traceability data structure');
            }
            return data; // Return the parsed data
        } catch (e) {
            // Throw a detailed error if parsing fails
            throw new Error(`Failed to parse traceability data for batch ${batchId} and phase ${phase}: ${e.message}`);
        }
    }

    // Publish quality verification results to the public ledger
    async _publishQualityResults(ctx, batchId, phase, report, publicFields) {
        // Sanitize inputs
        batchId = this._sanitizeInput(batchId);
        phase = this._sanitizeInput(phase);

        // Define default fields to publish if none are specified
        const allowedFields = publicFields.length > 0 ? publicFields : [
            'batchId',
            'phase',
            'compliant',
            'verificationDate',
            'verificationOrg',
            'parametersWithIssues'
        ];

        // Create the public record by selecting allowed fields
        const publicRecord = {};
        for (const field of allowedFields) {
            if (field === 'parametersWithIssues') {
                // Map violations to include only parameter and severity
                publicRecord[field] = report.violations?.map(v => ({
                    parameter: v.parameter,
                    severity: v.severity
                })) || [];
            } else if (report[field] !== undefined) {
                // Copy the field from the report if it exists
                publicRecord[field] = report[field];
            } else {
                // Throw an error if a required field is missing
                throw new Error(`Required field ${field} is missing in report`);
            }
        }

        // Add verification metadata
        const txTimestamp = ctx.stub.getTxTimestamp();
        publicRecord.verificationDate = new Date(txTimestamp.seconds * 1000 + txTimestamp.nanos / 1000000).toISOString();
        publicRecord.verificationOrg = ctx.clientIdentity.getMSPID();

        // Store the public record on the ledger
        const publicKey = `PUBLIC_QUALITY_${batchId}_${phase}`;
        await ctx.stub.putState(publicKey, Buffer.from(JSON.stringify(publicRecord)));
        // Emit an event to notify listeners of the public quality result
        ctx.stub.setEvent('PublicQualityResult', Buffer.from(JSON.stringify(publicRecord)));
        // Log the publishing action
        await this._logAudit(ctx, 'PublishQualityResults', { batchId, phase, publicFields });
    }
}

// Export the contract class for use by Hyperledger Fabric
module.exports = QualityAssuranceContract;