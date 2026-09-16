---
name: scaffold-test-users
description: Generate and append a requested number of unique fictional test users to config/seed.json while preserving the existing email domain and seed schema.
---

# Scaffold test users

Use this skill when the user asks to generate test users for the seed data.

## Required input

- The user must provide a positive whole number `N`, meaning **append N new users** to the existing `users` array.
- If the user does not provide `N`, ask exactly how many users they want to scaffold and wait for the answer before editing any file.
- Reject zero, negative numbers, decimals, or non-numeric values. Do not guess a count.

## Source of truth

1. Read `config/seed.json` before generating anything.
2. Preserve the existing JSON structure and all existing users.
3. Inspect every existing user in the `users` array and use the current users' email domain. In the current seed data this is `slacksim.test`, but always derive it from the file rather than hard-coding it.
4. If existing user email domains are inconsistent, stop and ask the user which domain should be used; do not silently choose one.

## User generation rules

For each of the N new users:

- Make the user clearly fictional and ordinary. Do not use known personalities, celebrities, public figures, historical figures, fictional characters, or recognizable aliases.
- Use Roman/Latin English names only. Names must contain ASCII English letters and spaces only: `A-Z`, `a-z`, and a single space between name parts. Do not use accents, apostrophes, hyphens, numbers, emoji, transliterations from another writing system, or words from other languages.
- Ensure uniqueness against both the existing users and all newly generated users:
  - `id`
  - `username`
  - `email`
  - case-insensitive `fullName`
  - `avatarSeed`
- Use a lowercase ASCII `username`, derived from the first name, with no special characters. If a first name collides, use a deterministic numeric suffix such as `name2`.
- Use a lowercase ASCII email local part based on the username and the exact existing domain, for example `marin2@slacksim.test`.
- Set `fullName` to a unique fictional first and last name.
- Set `avatarSeed` to a unique lowercase ASCII value, normally the normalized full name without spaces.
- Assign IDs sequentially after the highest existing user ID, preserving the repository's zero-padded style (`U006`, `U007`, ...). If an existing ID does not match `U` followed by digits, inspect it and choose a non-colliding ID consistent with the file instead of renumbering existing users.
- Do not add `avatarUrl` unless the user explicitly requests avatar files; generated users should use `avatarSeed` only.

## Validation before writing

Before modifying `config/seed.json`, verify all of the following:

- Exactly N users will be appended.
- Every new user has exactly the expected fields: `id`, `username`, `fullName`, `email`, and `avatarSeed`.
- All IDs, usernames, emails, full names, and avatar seeds are unique case-insensitively across the complete resulting users array.
- Every generated email ends with the domain derived from the existing users.
- Every generated `username`, email local part, and `avatarSeed` matches lowercase ASCII letters and digits only.
- Every generated `fullName` matches ASCII letters and single spaces only.
- `config/seed.json` remains valid JSON.
- Existing users, channels, DMs, messages, and all unrelated fields are unchanged.

If any check fails, regenerate the conflicting user rather than weakening a rule.

## File update and response

- Edit only `config/seed.json` for the data change.
- Append the new users after the existing users; do not reorder or replace users.
- After writing, parse the JSON and run the repository's relevant validation or test command when practical.
- Report the number of users added, the ID range, and the email domain used. Do not claim success if validation fails.

## Example

For a request to scaffold 2 users in the current seed file, append two users after `U005`, assign `U006` and `U007`, and use `@slacksim.test` for both addresses. Do not modify channel membership or other seed entities.
