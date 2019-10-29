import { Container } from "./Container";

const queries = [
    [["MRF", "LVC", "LVJ", "LIV"], ["NRW"]],
    [["TBW", "PDW"], ["HGS"]],
    [["PDW", "MRN"], ["LVC", "LVJ", "LIV"]],
    [["PDW", "AFK"], ["NRW"]],
    [["PDW"], ["BHM", "BMO", "BSW", "BHI"]],
    [["PNZ"], ["DIS"]],
    [["YRK"], ["DIS"]],
    [["WEY"], ["RDG"]],
    [["YRK"], ["NRW"]],
    [["BHM", "BMO", "BSW", "BHI"], ["MCO", "MAN", "MCV", "EXD"]],
    [["BHM", "BMO", "BSW", "BHI"], ["EDB"]],
    [["COV", "RUG"], ["MAN", "MCV"]],
    [["YRK"], ["MCO", "MAN", "MCV", "EXD"]],
    [["STA"], ["PBO"]],
    [["PNZ"], ["EDB"]],
    [["RDG"], ["IPS"]],
    [["DVP"], ["BHM", "BMO", "BSW", "BHI"]],
    [["BXB"], ["DVP"]],
    [["MCO", "MAN", "MCV", "EXD"], ["CBW", "CBE"]],
    [
        ["MCO", "MAN", "MCV", "EXD"],
        [
            "EUS", "MYB", "STP", "PAD", "BFR", "CTK", "CST", "CHX", "LBG",
            "WAE", "VIC", "VXH", "WAT", "OLD", "MOG", "KGX", "LST", "FST"
        ]
    ],
    [
        ["BHM", "BMO", "BSW", "BHI"],
        [
            "EUS", "MYB", "STP", "PAD", "BFR", "CTK", "CST", "CHX", "LBG",
            "WAE", "VIC", "VXH", "WAT", "OLD", "MOG", "KGX", "LST", "FST"
        ]
    ],
    [
        ["ORP"],
        [
            "EUS", "MYB", "STP", "PAD", "BFR", "CTK", "CST", "CHX", "LBG",
            "WAE", "VIC", "VXH", "WAT", "OLD", "MOG", "KGX", "LST", "FST"
        ]
    ],
    [
        ["EDB"],
        [
            "EUS", "MYB", "STP", "PAD", "BFR", "CTK", "CST", "CHX", "LBG",
            "WAE", "VIC", "VXH", "WAT", "OLD", "MOG", "KGX", "LST", "FST"
        ]
    ],
    [
        ["CBE", "CBW"],
        [
            "EUS", "MYB", "STP", "PAD", "BFR", "CTK", "CST", "CHX", "LBG",
            "WAE", "VIC", "VXH", "WAT", "OLD", "MOG", "KGX", "LST", "FST"
        ]
    ]
];

async function run() {
    const container = new Container();
    const query = await container.getQuery();

    console.time("planning");
    const date = new Date();
    let numResults = 0;

    for (let i = 0; i < 3; i++) {
        for (const [origins, destinations] of queries) {
            const key = origins.join() + ":" + destinations.join();

            console.time(key);
            const results = await query.plan(origins, destinations, date, 36000);
            console.timeEnd(key);

            if (results.length === 0) {
                console.log("No results between " + key);
            }

            numResults += results.length;
        }
    }

    console.timeEnd("planning");
    console.log("Num journeys: " + numResults);
    console.log(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);

    await container.end();
}

run().catch(e => console.error(e));
