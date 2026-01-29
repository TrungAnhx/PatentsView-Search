import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users } from "lucide-react";
import { Patent } from "@/types";

interface PatentCardProps {
  patent: Patent;
  onClick: (patent: Patent) => void;
}

export function PatentCard({ patent, onClick }: PatentCardProps) {
  const primaryAssignee = patent.assignees?.[0]?.assignee_organization || "Unknown Assignee";
  const firstInventor = patent.inventors?.[0] ? `${patent.inventors[0].inventor_first_name} ${patent.inventors[0].inventor_last_name}` : "Unknown Inventor";

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group h-full flex flex-col"
      onClick={() => onClick(patent)}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
            <Badge variant="outline" className="mb-2 truncate max-w-[200px] text-xs font-normal text-muted-foreground">
                {patent.patent_number}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <CalendarDays className="h-3 w-3" />
                {patent.patent_date}
            </span>
        </div>
        <CardTitle className="text-lg leading-tight group-hover:text-primary line-clamp-2">
          {patent.patent_title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between pt-2">
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {patent.patent_abstract || "No abstract available."}
        </p>
        
        <div className="flex flex-col gap-1 mt-auto pt-4 border-t text-xs">
            <div className="flex items-center gap-2 font-medium">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{primaryAssignee}</span>
            </div>
             <div className="text-muted-foreground truncate pl-5">
                Inventor: {firstInventor}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
