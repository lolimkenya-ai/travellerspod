import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationPicker } from "../LocationPicker";

// Real timers + tiny waits — the component debounces 350ms.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("LocationPicker edge cases", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows no results dropdown when Nominatim returns empty array", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const onChange = vi.fn();
    render(<LocationPicker value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/search a city/i);
    fireEvent.change(input, { target: { value: "asdfghjklqwerty" } });

    await wait(450);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(onChange).toHaveBeenCalledWith("asdfghjklqwerty");
  });

  it("handles Nominatim rate-limit (HTTP 429) gracefully without crashing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate limited" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationPicker value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search a city/i);
    fireEvent.change(input, { target: { value: "Paris" } });

    await wait(450);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(input).toBeInTheDocument();
  });

  it("does not call fetch for queries shorter than 2 chars", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationPicker value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search a city/i);
    fireEvent.change(input, { target: { value: "a" } });

    await wait(450);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("debounces rapid typing into a single fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationPicker value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search a city/i);

    fireEvent.change(input, { target: { value: "Pa" } });
    fireEvent.change(input, { target: { value: "Par" } });
    fireEvent.change(input, { target: { value: "Pari" } });
    fireEvent.change(input, { target: { value: "Paris" } });

    await wait(500);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain("q=Paris");
  });
});
