# Progmiscon Web

Progmiscon is a frontend web application prototype for exploring pseudocode questions, introductory programming concepts, and misconceptions that commonly appear in anonymous student answer variations.

The current focus is frontend development, UI/UX design, dummy data structure, and misconception-centered user flow.

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
````

Brief explanation:

* `src/app` contains the main application setup.
* `src/pages` contains main pages such as Home, Material, Concepts, Misconceptions, and Review.
* `src/components` contains reusable UI components.
* `src/data` contains temporary mock data.
* `src/hooks` contains custom hooks for managing data and state.
* `src/services` contains the repository layer for accessing data.
* `src/types` contains TypeScript type definitions.
* `src/styles` contains global styling.

## Running the Project

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Current Status

This project is currently a frontend prototype using dummy data.

The following parts are not implemented yet:

* real backend integration
* real authentication
* final dataset integration
* final answer tree visualization
* production-ready lecturer review workflow

## Development Notes

Planned improvements include:

* aligning dummy data with the real misconception dataset
* improving the mapping between answers, concepts, and misconceptions
* integrating the final answer tree visualization
* refining the lecturer Review workflow
* preparing backend API integration
* improving UI/UX based on supervisor and client feedback
