export interface IGenericUsers {
  name: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  image: string | null;
}
