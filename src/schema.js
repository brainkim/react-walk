import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString
} from 'graphql';

export const root = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'game',
    description: 'TODO',
    fields: {
      fen: { type: GraphQLString }
    },
  }),
});
