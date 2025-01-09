/*
 * SPDX-License-Identifier: Apache-2.0
 */

package edu.tsp;

import com.owlike.genson.annotation.JsonProperty;
import org.hyperledger.fabric.contract.annotation.DataType;
import org.hyperledger.fabric.contract.annotation.Property;

import java.util.List;
import java.util.Objects;

/**
 * ProductProperties structure used for handling result of query
 *
 */
@DataType()
public final class ProductProperties {
    @Property()
    private final String productId;

    @Property()
    private final List<ProductProperty> properties;

    public ProductProperties(@JsonProperty("productId") final String productId,
                             @JsonProperty("properties") final List<ProductProperty> properties) {
        this.productId = productId;
        this.properties = properties;
    }

    public String getProductId() {
        return productId;
    }

    public List<ProductProperty> getProperties() {
        return properties;
    }

    @Override
    public boolean equals(final Object obj) {
        if (this == obj) {
            return true;
        }

        if ((obj == null) || (getClass() != obj.getClass())) {
            return false;
        }

        ProductProperties other = (ProductProperties) obj;

        return productId.equals(other.productId) && Objects.deepEquals(properties, other.properties);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.getProductId(), this.getProperties());
    }

    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append(this.getClass().getSimpleName());
        builder.append("@");
        builder.append(Integer.toHexString(hashCode()));
        builder.append(" [productId=").append(productId);
        for (ProductProperty property : properties) {
            builder.append(", ")
                    .append(property.getName())
                    .append("=")
                    .append(property.getValue());
        }
        builder.append("]");

        return builder.toString();
    }
}
