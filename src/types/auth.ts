export type LecturerProfile = {
  userId: string;
  email: string;
  fullName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LecturerSignUpResult = {
  needsEmailConfirmation: boolean;
};
