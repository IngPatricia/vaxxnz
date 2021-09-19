import { useState, useEffect, useContext } from "react";
import { HealthpointLocationsContext } from "../../contexts";
import { memoizeOnce } from "../../utils/memoize";

export interface OpeningHours {
  schedule: { [date: string]: string };
  exceptions: { [date: string]: string };
  notesHtml: string[];
}

export enum Instruction {
  anyoneEligible = "Anyone currently eligible can access",
  makeAppointment = "Make an appointment",
  enrolledOnly = "Eligible GP enrolled patients only",
  walkIn = "Walk in",
  invitationOnly = "By invitation only",
  driveThrough = "Drive through",
  allowsBookings = "Allows bookings",
}

export interface HealthpointLocationRaw {
  lat: number;
  lng: number;
  name: string;
  branch: string;
  isOpenToday: boolean;
  openTodayHours: string;
  url: string;
  instructionLis: Instruction[];
  address: string;
  faxNumber: string;
  telephone: string;
  opennningHours: OpeningHours;
}
export interface HealthpointLocation extends HealthpointLocationRaw {
  isHealthpoint: true;
}

export const getHealthpointData = memoizeOnce(
  async (): Promise<HealthpointLocation[]> => {
    const r = await fetch(
      "https://raw.githubusercontent.com/CovidEngine/vaxxnzlocations/main/healthpointLocations.json"
    );
    const locs = await r.json();
    return locs.map((l: HealthpointLocationRaw) => ({
      isHealthpoint: true,
      ...l,
    }));
  }
);

export function useHealthpointLocations() {
  const { value, setValue } = useContext(HealthpointLocationsContext);
  useEffect(() => {
    if (value === null) {
      getHealthpointData()
        .then((locations) => {
          setValue(locations);
        })
        .catch((e) => {
          console.error("useHealthpointLocations e", e);
          setValue([]);
        });
    }
  }, [setValue, value]);
  return value;
}

type HealthpointDataResult =
  | { ok: HealthpointLocation[] }
  | { error: Error }
  | { loading: true };

const useHealthpointData = (): HealthpointDataResult => {
  const [healthpointLocations, setHealthpointLocations] = useState<
    HealthpointLocation[] | null
  >(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getHealthpointData()
      .then((locations) => {
        setHealthpointLocations(locations);
      })
      .catch((err) => setError(err));
  }, []);

  if (error) {
    return { error };
  } else if (healthpointLocations) {
    return { ok: healthpointLocations };
  } else {
    return { loading: true };
  }
};

type HealthpointLocationsResult =
  | { ok: HealthpointLocation[] }
  | { error: Error }
  | { loading: true };

export const useHealthpointLocationsFiltered =
  (): HealthpointLocationsResult => {
    const allLocations = useHealthpointData();

    if ("ok" in allLocations) {
      return { ok: filterHealthpointLocation(allLocations.ok) };
    } else {
      return allLocations;
    }
  };

function filterHealthpointLocation(allLocations: HealthpointLocation[]) {
  const matchedFilter = allLocations.filter(
    ({ isOpenToday, instructionLis: bps }) => {
      const filterBoolean =
        (bps.includes(Instruction.walkIn) ||
          bps.includes(Instruction.driveThrough)) &&
        !(
          bps.includes(Instruction.enrolledOnly) ||
          bps.includes(Instruction.invitationOnly)
        );

      return isOpenToday && filterBoolean;
    }
  );
  return matchedFilter;
}
