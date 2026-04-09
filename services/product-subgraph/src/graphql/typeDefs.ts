import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.5"
      import: ["@key"]
    )

  type Query {
    ping: String!
    product(id: ID!): Product
    products: [Product!]!
  }

  type Product @key(fields: "id") {
    id: ID!
    name: String!
  }
`;
