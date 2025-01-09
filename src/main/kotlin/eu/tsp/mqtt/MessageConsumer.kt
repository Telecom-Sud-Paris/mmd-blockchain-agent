package eu.tsp.mqtt

import eu.tsp.hyperledger.HFPublisher

class MessageConsumer(
    private val publisherId: String,
    private val hfPublisher: HFPublisher
) {

    fun consume(productId: String, property: String, value: String) {
        hfPublisher.publish(publisherId, productId, property, value)
    }

}