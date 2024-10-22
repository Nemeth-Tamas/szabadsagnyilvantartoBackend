import { Client, Databases, Query, Users } from 'node-appwrite';

/**
 * Returns the current user's szabadsagok
 * body.submittingId: string
 */
export default async ({ req, res, log, error }) => {
  const client = new Client();
  
  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const szabadsagId = process.env.APPWRITE_SZABADSAG_COLLECTION;

  // Validate the environment variables
  if (!dbId || !szabadsagId) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId) {
      throw new Error("submittingId is missing in the request body.");
    }
    submittingId = body.submittingId;
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing userId" });
  }

  log(`Fetching szabadsag for user ID: ${submittingId}`);

  try {
    let submittingUser = await users.get(submittingId);
    if (submittingUser.prefs.perms.includes("felhasznalo.request")) {
      let szabadsagok = await database.listDocuments(dbId, szabadsagId, [
        Query.equal("userId", submittingUser.$id),
        Query.orderDesc("$createdAt"),
        Query.limit(1000)
      ]);
      return res.json({ status: "success", szabadsagok });
    } else {
      return res.json({ status: "fail", error: "Permission denied" });
    }
  } catch (err) {
    error(`Error fetching szabadsag: ${err.message}`);
    return res.json({ status: "fail", error: err.message || "Unknown error" });
  }
};
