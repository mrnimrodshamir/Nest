export interface Child {
  id: string;
  name: string;
  birthdate: string | null; // ISO date (yyyy-mm-dd)
  avatarUrl: string | null;
  isDefault: boolean;
}
