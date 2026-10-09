# Changelog

Notable changes to ShelfLife AI are recorded here.

## [Unreleased]

### Added

- Ingredient list filtering by unit and status, including an archived-items switch.
- Server-side validation and filtering for ingredient unit and status query parameters.

### Changed

- Updated the ingredient, user management, account request, change request, usage, and waste screens with more consistent spacing and responsive layouts.
- Refined audit and directory tables to keep columns readable, contain long values, and scroll horizontally on smaller screens.
- Moved pending account approvals into the Super Admin user directory and adjusted the surrounding spacing and controls.

### Fixed

- Ingredient filters now apply unit and active/archived status to API results; the default list continues to show active ingredients.
- Account request tables now keep long names, emails, and decision actions within their columns.

### Maintenance

- Refreshed the lockfile's patch versions for `proxy-addr`, `serialize-javascript`, and `source-map-js`.
