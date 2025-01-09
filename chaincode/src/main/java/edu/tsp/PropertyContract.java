/*
 * SPDX-License-Identifier: Apache-2.0
 */

package edu.tsp;

import com.owlike.genson.Genson;
import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.contract.ContractInterface;
import org.hyperledger.fabric.contract.annotation.Contract;
import org.hyperledger.fabric.contract.annotation.Info;
import org.hyperledger.fabric.contract.annotation.Contact;
import org.hyperledger.fabric.contract.annotation.License;
import org.hyperledger.fabric.contract.annotation.Default;
import org.hyperledger.fabric.contract.annotation.Transaction;
import org.hyperledger.fabric.shim.ChaincodeException;
import org.hyperledger.fabric.shim.ChaincodeStub;
import org.hyperledger.fabric.shim.ledger.KeyValue;
import org.hyperledger.fabric.shim.ledger.QueryResultsIterator;

import java.util.ArrayList;
import java.util.List;

/**
 * Java implementation of the Property Contract
 */
@Contract(
        name = "PropertyContract",
        info = @Info(
                title = "Property contract",
                description = "The MoreMedDiet Property contract",
                version = "0.0.1-SNAPSHOT",
                license = @License(
                        name = "Apache 2.0 License",
                        url = "http://www.apache.org/licenses/LICENSE-2.0.html"),
                contact = @Contact(
                        email = "michal.kit@telecom-sudparis.eu",
                        name = "PropertyContract")))
@Default
public final class PropertyContract implements ContractInterface {

    private final Genson genson = new Genson();

    private enum PropertyContractErrors {
        NOT_FOUND,
        ALREADY_EXISTS
    }

    /**
     * Retrieves a properties with the specified key from the ledger.
     *
     * @param ctx       the transaction context
     * @param productId the product ID
     * @return the ProductProperties found on the ledger if there was one
     */
    @Transaction()
    public String queryProductProperties(final Context ctx, final String productId) {
        ChaincodeStub stub = ctx.getStub();
        String key = stub.createCompositeKey(productId).toString();
        QueryResultsIterator<KeyValue> results = stub.getStateByPartialCompositeKey(key);
        List<ProductProperty> properties = new ArrayList<>();

        for (KeyValue result : results) {
            ProductProperty productProperty = genson.deserialize(result.getStringValue(), ProductProperty.class);
            properties.add(productProperty);
        }

        if (properties.isEmpty()) {
            String errorMessage = String.format("Product with ID=%s does not exist", productId);
            System.out.println(errorMessage);
            throw new ChaincodeException(errorMessage, PropertyContractErrors.NOT_FOUND.toString());
        }

        return new ProductProperties(productId, properties).toString();
    }

    @Transaction()
    public void initLedger(final Context ctx) {
        //Do nothing
    }

    /**
     * Creates (or updates) a new product property state on the ledger.
     *
     * @param ctx           the transaction context
     * @param productId     id of the product
     * @param propertyName  product property name
     * @param propertyValue product property value
     * @return the created/updated ProductProperty
     */
    @Transaction()
    public String createOrUpdateProductProperty(final Context ctx,
                                                final String productId,
                                                final String propertyName,
                                                final String propertyValue,
                                                final Long timestamp) {
        ChaincodeStub stub = ctx.getStub();

        ProductProperty productProperty = new ProductProperty(propertyName, propertyValue, timestamp);
        String productPropertyState = genson.serialize(productProperty);
        String key = stub.createCompositeKey(productId, propertyName).toString();
        stub.putStringState(key, productPropertyState);

        return productPropertyState;
    }
}
