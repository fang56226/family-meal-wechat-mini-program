# Our Little Kitchen

A private, serverless WeChat Mini Program designed for collaborative meal planning and dining records within a family.

Family members can maintain a shared menu, place meal orders, manage cooking progress, upload food photos, and preserve memories of each meal. The application is intended for private family use rather than public commercial distribution.

## Key Features

* **Family membership management**

  * The first user becomes the administrator.
  * New members must be approved before accessing family data.
  * Administrators can approve, disable, and manage members.

* **Shared menu management**

  * Approved members can create, edit, and remove dishes.
  * Each dish can include a photo, ingredient list, cooking notes, and category.
  * Previously created categories can be reused when adding new dishes.

* **Direct meal ordering**

  * Family members can select dishes and create a meal order directly.
  * No payment or virtual-point system is required.
  * Dish quantities can be adjusted before ordering.

* **Cooking workflow**

  * The cook can view the current order and its selected dishes.
  * Orders progress through preparation and completion states.
  * The application records the person who placed the order and the person who prepared it.

* **Meal memories**

  * Completed meals can include 1–9 photos and a short caption.
  * Meal records preserve dishes, participants, timestamps, notes, and photos.
  * Existing records can be edited and their photos can be added or removed.

* **Cross-user photo sharing**

  * Approved family members can view dish and meal photos uploaded by one another.
  * Cloud functions generate temporary authorised URLs for shared cloud-storage files.

## Technology Stack

* WeChat Mini Program
* JavaScript
* WXML and WXSS
* WeChat Cloud Development
* Cloud Database
* Cloud Storage
* Node.js Cloud Functions

## Architecture

The project uses a serverless architecture based on WeChat Cloud Development:

```text
WeChat Mini Program
        |
        v
Node.js Cloud Functions
        |
        +-- Cloud Database
        +-- Cloud Storage
```

The client does not directly modify protected database records. Business operations are processed through cloud functions, which validate membership and permissions before accessing shared family data.

## Project Structure

```text
.
├── cloudfunctions/
│   └── familyApi/          # Backend business logic and permission checks
├── miniprogram/
│   ├── components/         # Reusable interface components
│   ├── pages/              # Mini Program pages
│   ├── utils/              # API utilities
│   ├── app.js
│   ├── app.json
│   └── app.wxss
├── database-rules.json     # Database security-rule reference
├── storage-rules.json      # Cloud-storage security-rule reference
├── project.config.json     # WeChat Developer Tools configuration
└── README.md
```

## Cloud Database Collections

The application uses three primary collections:

* `users` — family members, roles, approval status, and display names
* `dishes` — menu items, ingredients, notes, categories, and photo references
* `orders` — selected dishes, order status, cooking information, and meal records

## Local Setup

1. Clone or download this repository.
2. Open WeChat Developer Tools.
3. Select **Import Project**.
4. Choose the downloaded project directory.
5. Replace `touristappid` in `project.config.json` with your own Mini Program AppID.
6. Enable WeChat Cloud Development and create a cloud environment.
7. Create the following database collections:

   * `users`
   * `dishes`
   * `orders`
8. Configure the database rules using `database-rules.json` as a reference.
9. Configure cloud-storage permissions using `storage-rules.json` as a reference.
10. Right-click `cloudfunctions/familyApi` and select **Upload and Deploy: Cloud Installation of Dependencies**.
11. Compile and run the Mini Program.

The first user who opens the application becomes the family administrator. Additional users must be approved from the member-management page.

## Privacy and Security

* The application is designed for a small, private group of approved family members.
* Database access is protected through cloud functions and membership validation.
* Uploaded photos and production database records are not included in this repository.
* Private configuration files, AppSecrets, access tokens, and other credentials must never be committed to GitHub.
* The public repository uses `touristappid`; developers should provide their own AppID locally.

## Status

The application has been implemented and tested on real mobile devices with multiple family accounts.

## Author

**Yijun Fang**
BA Philosophy and Computer Science, University College London
