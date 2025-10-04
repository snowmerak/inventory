#!/bin/bash
# Generate a random key for replica set internal authentication
openssl rand -base64 756 > /data/mongodb-keyfile
chmod 400 /data/mongodb-keyfile
chown 999:999 /data/mongodb-keyfile
