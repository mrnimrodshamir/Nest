export type ChildSex = 'male' | 'female';

export interface Child {
  id: string;
  name: string;
  birthdate: string | null; // ISO date (yyyy-mm-dd)
  avatarUrl: string | null;
  isDefault: boolean;
  /** Optional — nullable for every child added before this field existed. */
  sex: ChildSex | null;
}
