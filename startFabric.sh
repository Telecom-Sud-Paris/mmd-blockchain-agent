#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# Exit on first error
set -e

# don't rewrite paths for Windows Git Bash users
# export MSYS_NO_PATHCONV=1
# starttime=$(date +%s)
# CC_SRC_LANGUAGE="javascript"
# CC_SRC_LANGUAGE=`echo "$CC_SRC_LANGUAGE" | tr [:upper:] [:lower:]`
# CC_SRC_PATH="../chaincode"

# clean out any old identities in the wallets
rm -rf wallet/*.id

# launch network; create channel and join peer to channel
pushd ./test-network
./network.sh down
./network.sh up createChannel -ca -s couchdb
#./network.sh deployCC -ccn PropertyContract -ccv 1 -cci initLedger -ccl ${CC_SRC_LANGUAGE} -ccp ${CC_SRC_PATH}
popd

cat <<EOF

Total setup execution time : $(($(date +%s) - starttime)) secs ...

You can now use the Fabric SDKs to interact with the network.

EOF

