export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          storage_used_bytes: number;
          storage_limit_bytes: number;
          is_premium: boolean;
          guest_session_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          storage_used_bytes?: number;
          storage_limit_bytes?: number;
          is_premium?: boolean;
          guest_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          storage_used_bytes?: number;
          storage_limit_bytes?: number;
          is_premium?: boolean;
          guest_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      files: {
        Row: {
          id: string;
          user_id: string | null;
          guest_session_id: string | null;
          folder_id: string | null;
          name: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          telegram_file_id: string;
          telegram_message_id: number;
          thumbnail_url: string | null;
          is_starred: boolean;
          is_trashed: boolean;
          trashed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          guest_session_id?: string | null;
          folder_id?: string | null;
          name: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          telegram_file_id: string;
          telegram_message_id: number;
          thumbnail_url?: string | null;
          is_starred?: boolean;
          is_trashed?: boolean;
          trashed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          guest_session_id?: string | null;
          folder_id?: string | null;
          name?: string;
          original_name?: string;
          mime_type?: string;
          size_bytes?: number;
          telegram_file_id?: string;
          telegram_message_id?: number;
          thumbnail_url?: string | null;
          is_starred?: boolean;
          is_trashed?: boolean;
          trashed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          id: string;
          user_id: string | null;
          guest_session_id: string | null;
          parent_id: string | null;
          name: string;
          color: string;
          is_trashed: boolean;
          trashed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          guest_session_id?: string | null;
          parent_id?: string | null;
          name: string;
          color?: string;
          is_trashed?: boolean;
          trashed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          guest_session_id?: string | null;
          parent_id?: string | null;
          name?: string;
          color?: string;
          is_trashed?: boolean;
          trashed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      shared_links: {
        Row: {
          id: string;
          file_id: string;
          created_by: string;
          token: string;
          expires_at: string | null;
          is_password_protected: boolean;
          password_hash: string | null;
          download_count: number;
          max_downloads: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          created_by: string;
          token?: string;
          expires_at?: string | null;
          is_password_protected?: boolean;
          password_hash?: string | null;
          download_count?: number;
          max_downloads?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          created_by?: string;
          token?: string;
          expires_at?: string | null;
          is_password_protected?: boolean;
          password_hash?: string | null;
          download_count?: number;
          max_downloads?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_links_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shared_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_storage: {
        Args: {
          user_id_param: string;
          bytes_param: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
