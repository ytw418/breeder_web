import React from "react";

const SkeletonItem = () => {
  return (
    <div className="flex cursor-pointer justify-between px-4 pt-5">
      <div className="flex space-x-4">
        <div className="h-20 w-20 rounded-md bg-gray-200 animate-pulse" />
        <div className="flex flex-col pt-2">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-200 rounded mt-2 animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 rounded mt-2 animate-pulse" />
        </div>
      </div>
      <div className="flex items-end justify-end">
        <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
};

export default SkeletonItem;
