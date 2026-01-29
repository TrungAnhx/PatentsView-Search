export interface Inventor {
  inventor_id: string;
  inventor_first_name: string;
  inventor_last_name: string;
}

export interface Assignee {
  assignee_id: string;
  assignee_organization: string;
  assignee_first_name?: string;
  assignee_last_name?: string;
}

export interface Patent {
  patent_id: string;
  patent_number: string;
  patent_title: string;
  patent_abstract: string;
  patent_date: string;
  inventors?: Inventor[];
  assignees?: Assignee[];
  cpcs?: { cpc_group_id: string; cpc_group_title: string }[];
}

export interface PatentsViewResponse {
  patents: Patent[];
  count: number;
  total_patent_count: number;
}
