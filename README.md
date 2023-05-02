# Szabadság nyilvántartó BACKEND

Used technologies:
 - NodeJS
 - ExpressJS
 - [Appwrite](https://appwrite.io/)

Appwrite used for:
 - User management
 - Database

## Permissions:
 - felhasznalo: 
   - request ("szabadság", "szülési szabadság", "temetési szabadság") - _felhasznalo.request_
   - delete request - _felhasznalo.delete_request_
 - irodavezeto:
   - everything that user can
   - approve - _irodavezeto.approve_
   - reject - _irpdavezeto.reject_
   - send message (to any user) - _irodavezeto.message_send_
   - list own - _irodavezeto.list_own_
 - jegyzo
   - everything that irodavezeto can
   - edit user - _jegyzo.edit_user_
   - create user - _jegyzo.create_user_
   - delete user - _jegyzo.delete_user_
   - list all - _jegyzo.list_all_
 - hr / rendszergazda
   - everything that jegyzo can
   - edit user permissions - _hr.edit_user_perms_
   - set user as on "apa szabadsag", "táppénz" - _hr.edit_user_current_state_

## Example user object
```json
{
    "$id": "",
    "$createdAt": "2023-04-23T15:06:24.398+00:00",
    "$updatedAt": "2023-04-30T18:36:45.539+00:00",
    "name": "",
    "password": "",
    "hash": "argon2",
    "hashOptions": {
        "type": "argon2",
        "memoryCost": 2048,
        "timeCost": 4,
        "threads": 3
    },
    "registration": "2023-04-23T15:06:24.397+00:00",
    "status": true,
    "passwordUpdate": "2023-04-23T15:06:24.397+00:00",
    "email": "",
    "phone": "",
    "emailVerification": false,
    "phoneVerification": false,
    "prefs": {
        "perms": [
            "felhasznalo.request",
            "felhasznalo.delete_request",
            "felhasznalo.send",
            "irodavezeto.approve",
            "irpdavezeto.reject",
            "irodavezeto.message_send",
            "jegyzo.edit_user",
            "jegyzo.create_user",
            "jegyzo.delete_user",
            "hr.edit_user_perms",
            "hr.edit_user_current_state",
            "jegyzo.list_all"
        ],
        "role": "admin",
        "manager": "",
        "maxdays": 40,
        "remainingdays": 27
    }
},
```

---

User api documentation can be found [here](https://documenter.getpostman.com/view/10735883/2s93Y5PKYK)

Szabadsagok api documentation can be found [here](https://documenter.getpostman.com/view/10735883/2s93eU1tSL)

Kerelmek api documentation can be found [here](https://documenter.getpostman.com/view/10735883/2s93eU1tWb)