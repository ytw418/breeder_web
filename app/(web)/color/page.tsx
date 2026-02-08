"use client";
import { Button } from "@components/ui/button";

import React from "react";

const page = () => {
  return (
    <div>
      <Button>기본</Button>
      <Button variant={"outline"}>기본outline</Button>

      <Button className="background">background</Button>
      <Button className="bg-foreground">bg-foreground</Button>
      <Button className="bg-primary">bg-primary</Button>
      <Button className="bg-primary-foreground">bg-primary-foreground</Button>
      <Button className="bg-card">bg-card</Button>
      <Button className="bg-card-foreground">bg-card-foreground</Button>
      <Button className="bg-muted">bg-muted</Button>
      <Button className="bg-muted-foreground">bg-muted-foreground</Button>
      <Button className="bg-accent-foreground">bg-accent-foreground</Button>
      <Button className="bg-accent">bg-accent</Button>
      <Button className="bg-popover-foreground">bg-popover-foreground</Button>
      <Button className="bg-popover">bg-popover</Button>
      <Button className="bg-secondary-foreground">
        bg-secondary-foreground
      </Button>
      <Button className="bg-secondary">bg-secondary</Button>

      <Button className="bg-destructive-foreground">
        bg-destructive-foreground
      </Button>
      <Button className="bg-destructive">bg-destructive</Button>
    </div>
  );
};

export default page;
