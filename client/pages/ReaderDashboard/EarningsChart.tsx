import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, Tooltip, CategoryScale, Legend } from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, CategoryScale, Legend);

export default function EarningsChart() {
  const { data: payouts, isLoading } = useQuery({
    queryKey: ["payouts"],
    queryFn: async () => {
      const res = await fetch("/api/payouts/reader");
      return res.ok ? await res.json() : [];
    },
  });

  // Build daily earnings
  const daily: Record<string, number> = {};
  (payouts || []).forEach((p: any) => {
    const day = p.paidAt ? p.paidAt.slice(0, 10) : "";
    if (day) daily[day] = (daily[day] || 0) + p.amountCents;
  });

  const labels = Object.keys(daily).sort();
  const data = {
    labels,
    datasets: [
      {
        label: "Earnings ($)",
        data: labels.map((d) => (daily[d] || 0) / 100),
        borderColor: "#FF69B4",
        backgroundColor: "rgba(255,105,180,0.3)",
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="bg-black bg-opacity-70 rounded-xl p-6 mt-8">
      <h3 className="font-heading text-xl text-gold mb-4">Earnings Chart</h3>
      {isLoading ? (
        <div className="text-gold">Loading...</div>
      ) : (
        <Line data={data} options={{ responsive: true, plugins: { legend: { display: false }}}} />
      )}
      <table className="w-full mt-6 text-white font-body">
        <thead>
          <tr>
            <th className="text-left">Date</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(payouts || []).slice(0, 10).map((p: any) => (
            <tr key={p.id}>
              <td>{p.paidAt ? p.paidAt.slice(0, 10) : "-"}</td>
              <td className="text-right">${(p.amountCents / 100).toFixed(2)}</td>
              <td>
                <span className={p.status === "paid" ? "text-green-400" : "text-gold"}>
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}