import * as chai from "chai";
import { isTransfer } from "./Journey";

describe("isTransfer", () => {

  it("returns true when given a transfer", () => {
    const transfer = { origin: "A", destination: "B", duration: 15, startTime: 0, endTime: 0 };
    const result = isTransfer(transfer);

    chai.expect(result).to.be.true;
  });

  it("returns false when given a timetable leg", () => {
    const timetableLeg = { origin: "A", destination: "B", stopTimes: [], trip: {} as any };
    const result = isTransfer(timetableLeg);

    chai.expect(result).to.be.false;
  });

});
