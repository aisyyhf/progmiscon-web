# Progmiscon Web

Progmiscon is a frontend web app prototype for exploring pseudocode questions, introductory programming concepts, and misconceptions that commonly appear in anonymous student answer variations.

This project is developed as part of an internship / Kerja Praktik (KP) project. The current focus is on frontend development, UI/UX design, dummy data structure, and misconception-centered user flow.

## Project Purpose

Progmiscon is designed to help users:

- explore pseudocode questions by material
- understand introductory programming concepts
- browse misconceptions related to specific concepts
- inspect anonymous answer variations that reflect certain misconceptions
- support lecturers in validating misconception labels through a dedicated Review page

This project is not a grading system, not an LMS, and not an analytics dashboard. The main focus is the relationship between questions, concepts, misconceptions, and answer variations.

## Tech Stack

This project uses:

- React
- TypeScript
- Vite
- Tailwind CSS

Reasons for using this stack:

- React is used to build an interactive component-based user interface.
- TypeScript is used to keep the data structure safer and more consistent.
- Vite is used because it is lightweight and fast for frontend development.
- Tailwind CSS is used to speed up styling and maintain visual consistency.

## Current Features

- Home page
- Material page
- Concept page
- Misconception page
- Question detail page with anonymous answer cases
- Answer-case filtering by misconception
- Placeholder for answer tree visualization
- Mock lecturer login
- Lecturer-only Review page
- Dummy priority logic for misconception review tasks
- Indonesian and English language toggle
- Dummy data for prototype development

## Main User Flows

### Public / Student Flow

Public users can access:

- Home
- Material
- Concepts
- Misconceptions

Public users can browse questions, concepts, misconceptions, and anonymous answer variations without logging in.

### Lecturer Flow

Lecturers can use a mock login to access the Review page.

The Review page is used to validate whether a misconception label attached to an answer case is appropriate or not. This is not a grading feature.

## Project Structure

```text
src/
  app/
  components/
  data/
  hooks/
  pages/
  services/
  types/
  utils/
  styles/