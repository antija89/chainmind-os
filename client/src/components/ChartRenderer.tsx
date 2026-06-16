import React from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartSpec {
  type?: 'bar' | 'line' | 'pie';
  title?: string;
  labels?: string[];
  values?: number[];
  data?: any[];
  datasets?: any[];
  [key: string]: any;
}

interface ChartRendererProps {
  spec: ChartSpec | string;
  height?: number;
  width?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];

export const ChartRenderer: React.FC<ChartRendererProps> = ({ spec, height = 300, width = '100%' }) => {
  // Parse if string
  let chartSpec: ChartSpec;
  try {
    chartSpec = typeof spec === 'string' ? JSON.parse(spec) : spec;
  } catch {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
        Invalid chart specification
      </div>
    );
  }

  const chartType = chartSpec.type || 'bar';
  const title = chartSpec.title || 'Chart';

  // Prepare data
  let data: any[] = [];
  
  if (chartSpec.data && Array.isArray(chartSpec.data)) {
    data = chartSpec.data;
  } else if (chartSpec.labels && chartSpec.values && Array.isArray(chartSpec.labels) && Array.isArray(chartSpec.values)) {
    data = chartSpec.labels.map((label, idx) => ({
      name: label,
      value: chartSpec.values![idx],
    }));
  } else if (chartSpec.datasets && Array.isArray(chartSpec.datasets)) {
    // Handle multi-dataset format
    const labels = chartSpec.labels || [];
    data = labels.map((label, idx) => {
      const item: any = { name: label };
      chartSpec.datasets?.forEach((dataset, datasetIdx) => {
        item[`dataset_${datasetIdx}`] = dataset.data?.[idx] || 0;
      });
      return item;
    });
  }

  if (data.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
        No data available for chart
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-4 my-4">
      {title && <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>}
      
      <ResponsiveContainer width={width} height={height}>
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#0088FE" />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#0088FE" />
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartRenderer;
