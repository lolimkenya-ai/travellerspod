import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { LocationPicker } from "../LocationPicker";

const DEBOUNCE = 350;

describe("LocationPicker edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 10);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // No <li> options rendered
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

    const onChange = vi.fn();
    render(<LocationPicker value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/search a city/i);
    fireEvent.change(input, { target: { value: "Paris" } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 10);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    // Component still renders the input
    expect(input).toBeInTheDocument();
  });

  it("does not call fetch for queries shorter than 2 chars", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationPicker value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search a city/i);
    fireEvent.change(input, { target: { value: "a" } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 50);
    });

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

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE + 10);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain("q=Paris");
  });
});
