import { Application } from "https://deno.land/x/oak/mod.ts";
import { applyGraphQL, gql } from "https://deno.land/x/oak_graphql/mod.ts";
import { MongoClient } from "https://deno.land/x/mongo@v0.8.0/mod.ts";

const client = new MongoClient();
client.connectWithUri("mongodb://localhost:27017");

// Defining schema interface
interface DogSchema {
  _id: { $oid: string };
  name: string;
  isGoodBoy: boolean;
}

const db = client.database("dogs");
const dogs = db.collection("dogs");

const app = new Application();

app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

const types = (gql as any)`
  type Dog {
    name: String
    isGoodBoy: Boolean
    id: ID
  } 

  input DogInput {
    name: String
    isGoodBoy: Boolean
  }

  type Query {
    foo: String
    dog: [Dog]
  }

  type Mutation {
    addDog(input: DogInput): Dog
  }
`;

const resolvers = {
  Query: {
    foo: () => "bar",
    dog: async () => {
      const doggos = await dogs.find();
      return doggos.map((doggo: any) => {
        const {
          _id: { $oid: id },
        } = doggo;
        doggo.id = id;
        return doggo;
      });
    },
  },
  Mutation: {
    addDog: async (
      _: any,
      { input: { name, isGoodBoy } }: any,
      context: any,
      info: any
    ) => {
      const { $oid: id } = await dogs.insertOne({ name, isGoodBoy });
      return { name, isGoodBoy, id };
    },
  },
};

const GraphQLService = await applyGraphQL({
  typeDefs: types,
  resolvers: resolvers,
  context: (ctx) => {
    return { user: "Aaron" };
  },
});

app.use(GraphQLService.routes(), GraphQLService.allowedMethods());

console.log("Server start at http://localhost:8080");
await app.listen({ port: 8080 });
