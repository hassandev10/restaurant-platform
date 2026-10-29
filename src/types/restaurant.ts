export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  currency: string;
  isOpen: boolean;
  estimatedPreparationMinutes: number;
}

export interface Branch {
  id: string;
  restaurantId: string;
  name: string;
}
