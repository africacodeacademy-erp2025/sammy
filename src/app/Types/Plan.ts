export interface Plan {
  _id?: string;
  planId: number;
  name: string;
  price: number;
  description: string;
  features: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
