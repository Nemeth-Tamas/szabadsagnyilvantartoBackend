import { Client, Databases, Users } from 'node-appwrite';

// This is your Appwrite function
// It's executed each time we get a request
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
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;
  const tappenzID = process.env.APPWRITE_TAPPENZ_COLLECTION;

  // Validate the environment variables
  if (!dbId || !plansID || !kerelmekId || !szabadsagID || !tappenzID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  let submittingUser;
  let userId;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.userId) {
      throw new Error("submittingId|userId is missing in the request body.");
    }
    submittingId = body.submittingId;
    userId = body.userId;

    submittingUser = await users.get(submittingId);
    let user = await users.get(userId);

    if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
      error(`User ${submittingId} is not allowed to update user permissions.`);
      return res.json({ status: "fail", error: "You are not allowed to update user permissions." });
    }

    let perms;
    if (body.perms != undefined) {
      perms = body.perms;
    } else {
      perms = user.prefs.perms;
    }

    let manager;
    if (body.manager != undefined) {
      manager = body.manager;
    } else {
      manager = user.prefs.manager;
    }

    let role;
    if (body.role != undefined) {
      role = body.role;
      if (body.role == "felhasznalo") {
        perms = ["felhasznalo.request", "felhasznalo.delete_request"]
      } else if (body.role == "irodavezeto") {
        perms = ["felhasznalo.request", "felhasznalo.delete_request", "irodavezeto.approve", "irpdavezeto.reject", "irodavezeto.message_send", "irodavezeto.list_own"]
      } else if (body.role == "jegyzo") {
        perms = ["felhasznalo.request","felhasznalo.delete_request","irodavezeto.approve","irpdavezeto.reject","irodavezeto.message_send","jegyzo.edit_user","jegyzo.create_user","jegyzo.delete_user","jegyzo.list_all"]
      } else if (body.role == "admin") {
        perms = ["felhasznalo.request","felhasznalo.delete_request","felhasznalo.send","irodavezeto.approve","irpdavezeto.reject","irodavezeto.message_send","jegyzo.edit_user","jegyzo.create_user","jegyzo.delete_user","hr.edit_user_perms","hr.edit_user_current_state","jegyzo.list_all"]
      }
    } else {
      role = user.prefs.role;
    }

    let maxdays;
    if (body.maxdays != undefined) {
      maxdays = body.maxdays;
    } else {
      maxdays = user.prefs.maxdays;
    }

    let remainingdays;
    if (body.remainingdays != undefined) {
      remainingdays = body.remainingdays;
    } else {
      remainingdays = user.prefs.remainingdays;
    }

    let sick;
    if (body.sick != undefined) {
      sick = body.sick;
    } else {
      sick = user.prefs.sick;
    }

    await users.updatePrefs(userId, { "perms": perms, "role": role, "manager": manager, "maxdays": maxdays, "remainingdays": remainingdays, "sick": sick });

    return res.json({ status: "success", user });
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }
};
