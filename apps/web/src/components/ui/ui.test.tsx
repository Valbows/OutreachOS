import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

describe("UI primitives", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders button variants, sizes, and disabled state", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary" size="lg" disabled>
          Secondary
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass(
      "bg-gradient-primary",
      "px-4",
    );
    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass(
      "border-outline/20",
      "px-6",
    );
    expect(screen.getByRole("button", { name: "Secondary" })).toBeDisabled();
  });

  it("renders card primitives with both surface states", () => {
    const { rerender } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );

    expect(screen.getByText("Title")).toHaveClass("text-lg");
    expect(screen.getByText("Content")).toBeInTheDocument();

    rerender(<Card elevated>Elevated</Card>);
    expect(screen.getByText("Elevated")).toHaveClass("shadow-ambient");
  });

  it("renders badges for default and outline variants", () => {
    const { rerender } = render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-primary/15");

    rerender(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline")).toHaveClass("border-outline-variant/30");
  });

  it("renders input labels, derived ids, explicit ids, and errors", () => {
    const { rerender } = render(
      <Input label="First Name" error="Required" placeholder="Name" />,
    );

    expect(screen.getByLabelText("First Name")).toHaveAttribute(
      "id",
      "first-name",
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("First Name")).toHaveClass("border-b-error");

    rerender(<Input id="custom-id" label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "custom-id");
  });

  it("opens and closes the modal based on the open prop and forwards close events", () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <Modal open onClose={onClose} title="Dialog title">
        Modal body
      </Modal>,
    );

    const dialog = container.querySelector("dialog");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(screen.getByText("Dialog title")).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();

    (dialog as HTMLDialogElement).dispatchEvent(new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal open={false} onClose={onClose}>
        Closed body
      </Modal>,
    );
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("renders table primitives together", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Name")).toHaveClass("font-mono");
    expect(screen.getByText("Alice")).toHaveClass("px-4", "py-3");
  });
});
