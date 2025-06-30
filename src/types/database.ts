export interface Value {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

export interface Goal {
  id: string;
  value_id: string;
  name: string;
  target_by?: string;
  created_at: string;
  user_id: string;
  value?: Value;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description?: string | null;
  
  // Recurrence settings
  recur_type: 'daily' | 'weekdays' | 'custom';
  custom_days?: number[] | null;
  
  // Time settings (optional) - now UTC timestamps
  start_time?: string | null; // UTC timestamp
  end_time?: string | null; // UTC timestamp
  
  // Relationships
  goal_id?: string | null;
  
  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  
  // Relationships (for queries)
  goal?: Goal;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  
  // Template relationship
  template_id?: string | null;
  
  // Scheduling fields (for one-time tasks) - now UTC timestamps
  start_time?: string | null; // UTC timestamp
  end_time?: string | null; // UTC timestamp
  recur?: 'once' | null; // Only 'once' remains, other recurring tasks use templates
  
  // Completion tracking
  is_done: boolean;
  completion_status?: 'completed' | 'skipped' | 'failed' | null;
  
  // Relationships
  goal_id?: string | null;
  
  // Metadata
  date: string;
  created_at: string;
  completed_at?: string | null;
  user_id: string;
  
  // Relationships (for queries)
  goal?: Goal;
  template?: TaskTemplate;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      values: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "values_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      goals: {
        Row: {
          id: string;
          name: string;
          value_id: string;
          target_by?: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          value_id: string;
          target_by?: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          value_id?: string;
          target_by?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_value_id_fkey";
            columns: ["value_id"];
            isOneToOne: false;
            referencedRelation: "values";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_time: string | null; // UTC timestamp
          end_time: string | null; // UTC timestamp
          recur: 'once' | 'daily' | 'weekdays' | 'custom' | null;
          custom_days: number[] | null;
          event_date: string | null;
          is_done: boolean;
          completion_status: 'completed' | 'skipped' | 'failed' | null;
          goal_id: string | null;
          date: string;
          created_at: string;
          completed_at: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          start_time?: string | null; // UTC timestamp
          end_time?: string | null; // UTC timestamp
          recur?: 'once' | 'daily' | 'weekdays' | 'custom' | null;
          custom_days?: number[] | null;
          event_date?: string | null;
          is_done?: boolean;
          completion_status?: 'completed' | 'skipped' | 'failed' | null;
          goal_id?: string | null;
          date: string;
          created_at?: string;
          completed_at?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          start_time?: string | null; // UTC timestamp
          end_time?: string | null; // UTC timestamp
          recur?: 'once' | 'daily' | 'weekdays' | 'custom' | null;
          custom_days?: number[] | null;
          event_date?: string | null;
          is_done?: boolean;
          completion_status?: 'completed' | 'skipped' | 'failed' | null;
          goal_id?: string | null;
          date?: string;
          created_at?: string;
          completed_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      task_templates: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          goal_id: string | null;
          user_id: string;
          recur_type: 'daily' | 'weekdays' | 'custom';
          custom_days: number[] | null;
          start_time: string | null; // UTC timestamp
          end_time: string | null; // UTC timestamp
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          goal_id?: string | null;
          user_id: string;
          recur_type: 'daily' | 'weekdays' | 'custom';
          custom_days?: number[] | null;
          start_time?: string | null; // UTC timestamp
          end_time?: string | null; // UTC timestamp
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          goal_id?: string | null;
          user_id?: string;
          recur_type?: 'daily' | 'weekdays' | 'custom';
          custom_days?: number[] | null;
          start_time?: string | null; // UTC timestamp
          end_time?: string | null; // UTC timestamp
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
} 