interface MessageProps {
  message: string;
  reversed?: boolean;
  avatar?: string | null;
  name?: string;
  time?: string;
}

export default function Message({
  message,
  reversed,
  avatar,
  name,
  time,
}: MessageProps) {
  return (
    <div
      className={`flex items-start space-x-2 ${
        reversed ? "flex-row-reverse space-x-reverse" : ""
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-slate-300" />
      <div className="flex flex-col">
        {name && <span className="text-sm text-gray-500">{name}</span>}
        <div className="flex items-end space-x-2">
          <div
            className={`px-4 py-2 rounded-2xl ${
              reversed ? "bg-orange-500 text-white" : "bg-gray-100"
            }`}
          >
            <p>{message}</p>
          </div>
          {time && (
            <span className="text-xs text-gray-500">
              {new Date(time).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
