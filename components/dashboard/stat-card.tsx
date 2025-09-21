import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface StatCardProps {
  stat: {
    title: string;
    value: string;
    description: string;
    icon: React.ReactNode;
    trend: "up" | "down" | "neutral";
  };
}

export function StatCard({ stat }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
        {stat.icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{stat.value}</div>
        <div className="flex items-center space-x-1">
          {stat.trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
          {stat.trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
          {stat.trend === "neutral" && <Minus className="h-4 w-4 text-gray-500" />}
          <p
            className={`text-xs ${
              stat.trend === "up"
                ? "text-green-500"
                : stat.trend === "down"
                  ? "text-red-500"
                  : "text-gray-500"
            }`}
          >
            {stat.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
