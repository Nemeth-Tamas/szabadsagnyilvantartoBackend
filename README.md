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
   - request ("szabadság", "szülési szabadság", "temetési szabadság") - _felhasznalo.reqest_
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

---

# Project: users

## End-point: http://localhost:9999/users/
This endpoint returns all of the registered users, with their data for the client to display them.

StartFragment

**submittingId**: The id of the currently logged in user submitting the get request to check for permissions.

EndFragm
### Method: GET
>```
>http://localhost:9999/users/
>```
### Body (**raw**)

```json
{
    "submittingId": ""
}
```


⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃

## End-point: http://localhost:9999/users/register
With this endpoint the client can create a new user. It is necessary to provide the following data:

- **submittingId**: The id of the currently logged in user trying to send this request. Used to check if the user has the apropriate permission to create the new user.
- **email**: the login name for the new user in the format of **username**@_location.identifier_.
- **password** is the plain text password of the user, which will get encrypted by the api.
- **name**: the full name of the new user
- **role**: the display name of the role for the user, if set to admin, all possible permissions will automatically apply.
- **manager**: the id of tha manager or boss for the new user, used for leave request send directions.
- **perms**: the permissions of the user. This will use presets that are stored in the client, but can be modified by another user that has the right permissions.
### Method: POST
>```
>http://localhost:9999/users/register
>```
### Body (**raw**)

```json
{
    "submittingId": "",
    "email": "",
    "password": "",
    "name": "",
    "role": "",
    "manager": "",
    "perms": []
}
```


⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃

## End-point: http://localhost:9999/users/:id
This endpoint lists all possible information for a single user.

StartFragment

**submittingId**: The id of the currently logged in user submitting the get request to check for permissions.

EndFragment
### Method: GET
>```
>http://localhost:9999/users/:id
>```
### Body (**raw**)

```json
{
    "submittingId": ""
}
```


⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃

## End-point: http://localhost:9999/users/:id
This endpoint is used for removeing users.

**submittingId**: The id of the currently logged in user submitting the remove request to check for permissions.
### Method: DELETE
>```
>http://localhost:9999/users/:id
>```
### Body (**raw**)

```json
{
    "submittingId": ""
}
```


⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃

## End-point: http://localhost:9999/users/:id/perms
This endpoint is used to edit the permissions for the given id.

**submittingId**: The id of the currently logged in user submitting the update request to check for permissions.

**perms**: The new list of perms
### Method: PATCH
>```
>http://localhost:9999/users/:id/perms
>```
### Body (**raw**)

```json
{
    "submittingId": "",
    "perms": []
}
```


⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃

## End-point: http://localhost:9999/users/:id/manager
This endpoint is used to edit the permissions for the given id.

**submittingId**: The id of the currently logged in user submitting the update request to check for permissions.

**manager**: The new manager ID
### Method: PATCH
>```
>http://localhost:9999/users/:id/manager
>```
### Body (**raw**)

```json
{
    "submittingId": "",
    "manager": ""
}
```


⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃

## End-point: http://localhost:9999/users/:id/role
This endpoint is used to edit the permissions for the given id.

**submittingId**: The id of the currently logged in user submitting the update request to check for permissions.

**role**: The new display role
### Method: PATCH
>```
>http://localhost:9999/users/:id/role
>```
### Body (**raw**)

```json
{
    "submittingId": "",
    "role": ""
}
```


⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃ ⁃

## End-point: http://localhost:9999/users/:id
This endpoint is used to edit the permissions for the given id.

**submittingId**: The id of the currently logged in user submitting the update request to check for permissions.

**perms**: The new list of perms

StartFragment

**role**: The new display role

EndFragmentStartFragment

**manager**: The new manager ID

EndFragment
### Method: PATCH
>```
>http://localhost:9999/users/:id
>```
### Body (**raw**)

```json
{
    "submittingId": "",
    "role": "",
    "manager": "",
    "perms": []
}
```
