import { Client, Databases, ID, Users } from 'node-appwrite';

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
  let kerelemId;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.kerelemId) {
      throw new Error("submittingId|kerelemId is missing in the request body.");
    }
    submittingId = body.submittingId;
    kerelemId = body.kerelemId;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    if (submittingUser.prefs.perms.includes("irodavezeto.approve")) {
      let current = await database.getDocument(dbId, kerelmekId, kerelemId);
      let szabadsag = await database.createDocument(dbId, szabadsagID, ID.unique(), {
        userId: current.submittingId,
        dates: current.dates,
        type: current.type,
        managerId: current.managerId,
      });

      let daysCount = current.dates.length;
      let user = await users.get(current.submittingId);
      let newPrefs = user.prefs;
      if (current.type == "SZ") {
        newPrefs.remainingdays -= daysCount;
      }
      let newUser = await users.updatePrefs(user.$id, newPrefs);

      let kerelem = await database.updateDocument(dbId, kerelmekId, kerelemId, {
        approved: true,
        szabadsagId: szabadsag.$id
      });

      return res.json({ status: "success", kerelem });
    } else {
      error("User does not have permission to approve requests.");
      return res.json({ status: "fail", error: "User does not have permission to approve requests." });
    }
  } catch (err) {
    error(`Failed to approve request by ID: ${err.message}`);
    return res.json({ status: "fail", error: "Failed to approve request by ID" });
  }
};
