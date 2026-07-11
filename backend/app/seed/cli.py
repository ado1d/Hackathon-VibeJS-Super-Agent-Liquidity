import argparse
import asyncio
import json

from app.database import SessionLocal
from app.services.scenarios import load_scenario, reset_operational_data
from app.api.metrics import validation_payload


async def run(args: argparse.Namespace) -> None:
    async with SessionLocal() as session:
        if args.command == "load":
            result = await load_scenario(session, args.code, if_empty=args.if_empty)
            print(json.dumps({"id": str(result.id), "code": result.code, "seed": result.seed}))
        elif args.command == "reset":
            await reset_operational_data(session)
            await session.commit()
            print(json.dumps({"status": "reset"}))
        else:
            print(json.dumps(await validation_payload(session), default=str, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    load = sub.add_parser("load")
    load.add_argument("code")
    load.add_argument("--if-empty", action="store_true")
    sub.add_parser("reset")
    sub.add_parser("metrics")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()

