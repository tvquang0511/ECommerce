export type AuthActor = {
  userId: string;
  email?: string;
  roles: string[];
  permissions: string[];
  sellerProfile:
    | {
        status: string;
        isKycVerified: boolean;
      }
    | null;
};
