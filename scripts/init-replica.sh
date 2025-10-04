#!/bin/bash

# Wait for MongoDB to be ready
sleep 5

# Initialize replica set
mongosh --host localhost:27017 -u admin -p admin123 --authenticationDatabase admin <<EOF
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" }
  ]
});
EOF

echo "Replica set initialized successfully"
