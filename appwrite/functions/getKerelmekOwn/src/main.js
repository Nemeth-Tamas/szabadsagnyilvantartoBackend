import { Client, Databases, Query, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const kerelmekId = process.env.APPWRITE_KERELMEK_COLLECTION;
  const szabadsagID = process.env.APPWRITE_SZABADSAG_COLLECTION;

  // Validate the environment variables
  if (!dbId || !kerelmekId || !szabadsagID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  let submittingUser;
  let offset;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId) {
      throw new Error("submittingId is missing in the request body.");
    }
    if (body.offset != undefined) {
      offset = body.offset;
    } else {
      offset = 0;
    }
    submittingId = body.submittingId;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    let kerelmek = await database.listDocuments(dbId, kerelmekId, [
      Query.equal("submittingId", submittingId),
      Query.orderDesc("$createdAt"),
      Query.limit(25),
      Query.offset(offset)
    ]);

    return res.json({ status: "success", kerelmek });
  } catch (err) {
    error(`Failed to list kerelmek: ${err.message}`);
    return res.json({ status: "fail", error: "Failed to list kerelmek" });
  }
};
