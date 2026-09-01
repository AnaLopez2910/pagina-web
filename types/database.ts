export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type StoreRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  whatsapp_phone: string;
  logo_path: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_paths: string[];
  address: string | null;
  theme: Json;
  business_hours: Json;
  restrict_by_schedule: boolean;
  show_categories: boolean;
  mobile_product_columns: number;
  free_shipping_enabled: boolean;
  free_shipping_threshold: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  image_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  promo_price: number | null;
  purchase_price: number;
  image_paths: string[];
  is_visible: boolean;
  stock_quantity: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OptionGroupRow = {
  id: string;
  product_id: string;
  name: string;
  selection_type: "SINGLE" | "MULTIPLE";
  is_required: boolean;
  min_selections: number;
  max_selections: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductOptionRow = {
  id: string;
  option_group_id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  store_id: string;
  code: string;
  status: "PENDING_WHATSAPP" | "PAID" | "DELIVERED" | "CANCELLED";
  customer_name: string;
  customer_phone: string;
  fulfillment: string;
  notes: string | null;
  total: number;
  checkout: Json;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  purchase_price: number;
  options: Json;
  subtotal: number;
};

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: StoreRow;
        Insert: Partial<StoreRow> & Pick<StoreRow, "owner_id" | "name" | "slug" | "whatsapp_phone">;
        Update: Partial<StoreRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Partial<CategoryRow> & Pick<CategoryRow, "store_id" | "name" | "slug">;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Partial<ProductRow> & Pick<ProductRow, "store_id" | "name" | "slug" | "base_price" | "purchase_price">;
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      option_groups: {
        Row: OptionGroupRow;
        Insert: Partial<OptionGroupRow> & Pick<OptionGroupRow, "product_id" | "name">;
        Update: Partial<OptionGroupRow>;
        Relationships: [];
      };
      product_options: {
        Row: ProductOptionRow;
        Insert: Partial<ProductOptionRow> & Pick<ProductOptionRow, "option_group_id" | "name">;
        Update: Partial<ProductOptionRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Partial<OrderRow> & Pick<OrderRow, "store_id" | "code" | "customer_name" | "customer_phone" | "fulfillment" | "total" | "checkout">;
        Update: Partial<OrderRow>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItemRow;
        Insert: Partial<OrderItemRow> & Pick<OrderItemRow, "order_id" | "product_name" | "quantity" | "unit_price" | "purchase_price" | "options" | "subtotal">;
        Update: Partial<OrderItemRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_public_order: {
        Args: {
          p_store_slug: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_fulfillment: string;
          p_notes: string | null;
          p_items: Json;
        };
        Returns: Array<{
          order_id: string;
          code: string;
          total: number;
          store_name: string;
          whatsapp_phone: string;
          items: Json;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
