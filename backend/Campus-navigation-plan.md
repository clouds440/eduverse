Implement Campus Navigation v1 using the existing Departments, Buildings, and Rooms system.

Goal:
Create a practical “Campus Navigation / Institute Map” feature that helps users find buildings, departments, rooms, and saved areas. V1 should not be a complex visual map. It should be a flow-style navigation/directory page built from existing structured data, while keeping the data model ready for a future visual/drag-drop map.

Important:
Do not build a full graphical map editor in this pass. Design the backend/data shape so a future visual map can be added without rewriting the feature.

Backend/model requirements:

1. Inspect current Building and Room models first.
2. Ensure buildings and rooms have all useful navigation fields.
3. Make `Room.floor` required if it is optional currently.
4. Add or verify useful fields for navigation:

   * Building:

     * `name`
     * `code`
     * `description`
     * `landmark`
     * `directionsNote`
     * `sortOrder`
     * future visual map fields if not already present: `mapX`, `mapY`, `mapWidth`, `mapHeight`
   * Room:

     * `name`
     * `code`
     * `floor` required
     * `type`
     * `capacity`
     * `landmark`
     * `directionsNote`
     * `sortOrder`
     * future visual map fields if not already present: `mapX`, `mapY`, `mapWidth`, `mapHeight`
5. Keep codes mandatory and org-scoped unique where applicable.
6. Do not expose internal UUIDs to users for navigation or CSV import.

Room type enum update:
Current room types are too limited:

* office
* classroom
* auditorium
* lab
* library
* hall
* other

Expand the Room.type enum in Prisma, backend validation, frontend forms, filters, display labels, CSV import validation, and any type mapping utilities.

Suggested useful room types:

* CLASSROOM
* LAB
* COMPUTER_LAB
* SCIENCE_LAB
* LIBRARY
* AUDITORIUM
* OFFICE
* ADMIN_OFFICE
* STAFF_ROOM
* TEACHER_ROOM
* PRINCIPAL_OFFICE
* FINANCE_OFFICE
* EXAM_ROOM
* MEETING_ROOM
* SEMINAR_ROOM
* HALL
* LECTURE_HALL
* SPORTS_ROOM
* MEDICAL_ROOM
* COUNSELING_ROOM
* STORAGE
* CAFETERIA
* PRAYER_ROOM
* RECEPTION
* SECURITY_ROOM
* WASHROOM
* OTHER

Use naming consistent with the existing enum style. If the current enum uses lowercase values, keep consistency unless the project already prefers uppercase Prisma enums.

CSV import requirements:

1. Update Building CSV import template and validation to include the new/required navigation fields.
2. Update Room CSV import template and validation to include:

   * buildingCode instead of buildingId
   * room code
   * room name
   * floor required
   * type
   * capacity
   * landmark
   * directionsNote
   * sortOrder if supported
3. Resolve room-to-building relationship using `buildingCode`, not UUID.
4. Validate that the building code exists in the same organization.
5. Return row-level errors with consistent `field: message` format.
6. Update sample CSV downloads and docs/help text.

Navigation feature requirements:

1. Build a new Campus Navigation / Institute Map page.
2. V1 should be flow-style, directory-based navigation, not a graphical drag/drop map.
3. The page should let users search and navigate to:

   * buildings
   * departments
   * rooms
   * saved areas / landmarks if supported
4. Make the navigation UI reusable as a component, not hardcoded to one page.
5. The reusable component should accept a target type and target id/code where possible:

   * building
   * department
   * room
   * area/landmark
6. Show navigation as structured breadcrumbs/flow, for example:
   `Science Department → Main Building → Floor 2 → Physics Lab / Room PHY-201`
7. For a room, show:

   * room name/code
   * building name/code
   * floor
   * type
   * department associations if available
   * landmark
   * directions note
   * schedules/sections using the room if existing APIs make this easy
8. For a building, show:

   * floors grouped with rooms
   * departments linked to the building if available
   * landmarks/directions note
9. For a department, show:

   * associated buildings
   * associated rooms
   * related courses/sections if already available and not too expensive

Frontend requirements:

1. Add search/filter by building, room, floor, department, room type, and code.
2. Add a clean “directory map” layout:

   * buildings as sections/cards
   * floors as grouped rows
   * rooms as clickable chips/cards/table rows
3. Keep the UI responsive.
4. Add empty states and helpful text.
5. Do not make the UI depend on fake coordinates yet.
6. Prepare types/interfaces so a future visual map can consume the same normalized navigation data.

API requirements:

1. Add navigation-friendly endpoints or reuse existing endpoints cleanly.
2. Prefer backend-processed response shapes so the frontend does not have to stitch everything manually.
3. Suggested endpoint:

   * `GET /campus-navigation`
   * optional filters: `q`, `buildingCode`, `departmentCode`, `floor`, `roomType`
4. Suggested response shape should include grouped buildings, floors, rooms, departments, and lookup metadata.
5. Keep role scoping/org scoping consistent with existing access rules.

Future visual map preparation:

1. Include optional coordinate/layout fields in the models/API, but do not build the full visual editor now.
2. Keep `mapX`, `mapY`, `mapWidth`, `mapHeight`, and `sortOrder` optional/defaulted so current users are not forced to manage map layout.
3. Document that these fields are reserved for future visual campus map rendering.
4. V1 should still work fully without coordinates.

Acceptance criteria:

1. Room floor is required everywhere: DB, DTOs, forms, CSV import, validation, and UI.
2. Building and Room CSV imports support navigation fields and use codes instead of UUIDs.
3. Room type enum is expanded and consistent across backend/frontend/imports.
4. Campus Navigation page can search and display buildings, floors, rooms, departments, and directions notes.
5. Users can find a room without needing database IDs.
6. Existing CRUD for buildings, rooms, departments, schedules, and sections does not break.
7. Future visual map support is prepared but not implemented as a full drag/drop editor.
