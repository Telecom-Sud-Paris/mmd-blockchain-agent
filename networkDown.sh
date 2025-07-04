#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# Exit on first error
set -ex

# Bring the test network down
pushd ./test-network
./network.sh down
popd

# clean out any old identities in the wallets
rm -rf wallet/*.id
