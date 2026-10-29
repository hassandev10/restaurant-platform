export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  currency: string;
  isOpen: boolean;
  estimatedPreparationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  restaurantId: string;
  name: string;
  createdAt: string;
}

export interface RestaurantSettingsUpdateRequest {
  name: string;
  description: string;
  logoUrl: string;
  currency: string;
  isOpen: boolean;
  estimatedPreparationMinutes: number;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  openingHours?: string;
}
