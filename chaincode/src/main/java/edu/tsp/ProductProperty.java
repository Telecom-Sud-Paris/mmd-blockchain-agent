/*
 * SPDX-License-Identifier: Apache-2.0
 */

package edu.tsp;

import com.owlike.genson.annotation.JsonProperty;
import org.hyperledger.fabric.contract.annotation.DataType;
import org.hyperledger.fabric.contract.annotation.Property;

import java.util.Objects;

@DataType()
public final class ProductProperty {

    @Property()
    private final String value;

    @Property()
    private final String name;

    @Property()
    private final Long timestamp;

    public String getValue() {
        return value;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public String getName() {
        return name;
    }

    public ProductProperty(@JsonProperty("name") final String name,
                           @JsonProperty("value") final String value,
                           @JsonProperty("timestamp") final Long timestamp) {
        this.value = value;
        this.name = name;
        this.timestamp = timestamp;
    }

    @Override
    public boolean equals(final Object obj) {
        if (this == obj) {
            return true;
        }

        if ((obj == null) || (getClass() != obj.getClass())) {
            return false;
        }

        ProductProperty other = (ProductProperty) obj;

        return value.equals(other.value) && timestamp.equals(other.timestamp) && name.equals(other.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(getValue(), getTimestamp(), getName());
    }

    @Override
    public String toString() {
        return this.getClass().getSimpleName() + "@"
                + Integer.toHexString(hashCode())
                + " [name=" + name + ", value=" + value + ", timestamp=" + timestamp + "]";
    }
}
