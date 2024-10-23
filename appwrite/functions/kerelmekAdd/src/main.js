import { Client, Databases, Functions, ID, Users } from 'node-appwrite';

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
  const checkAndSendEmail = process.env.APPWRITE_CHECK_MANAGAER_SEND_EMAIL_FUNCTION;

  // Validate the environment variables
  if (!dbId || !kerelmekId || !szabadsagID || !checkAndSendEmail) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);
  const functions = new Functions(client);

  let submittingId;
  let submittingUser;
  let managerId;
  let type;
  let dates;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.managerId || !body.type || !body.dates) {
      throw new Error("submittingId|managerId|type|dates is missing in the request body.");
    }
    submittingId = body.submittingId;
    managerId = body.managerId;
    type = body.type;
    dates = body.dates;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    if (submittingUser.prefs.perms.includes("felhasznalo.request")) {
      if (managerId != submittingUser.prefs.manager) {
        error(`User ${submittingId} is not allowed to request for ${managerId}`);
        return res.json({ status: "fail", error: "User is not allowed to request for this manager" });
      }
      let name = submittingUser.name;
      let kerelem = await database.createDocument(dbId, kerelmekId, ID.unique(), {
        submittingId: submittingId,
        managerId: managerId,
        type: type,
        dates: dates,
        submittingUserIdentifier: submittingUser.email.split('@')[1],
        submittingName: name
      });

      // Send email to manager
      functions.createExecution(checkAndSendEmail, JSON.stringify({
        managerId: managerId,
        name: name,
        dates: dates
      }));

      return res.json({ status: "success", kerelem });
    } else {
      error(`User ${submittingId} is not allowed to request`);
      return res.json({ status: "fail", error: "User is not allowed to request" });
    }
  } catch (err) {
    error(`Failed to create request: ${err.message}`);
    return res.json({ status: "fail", error: "Failed to create request" });
  }
};
