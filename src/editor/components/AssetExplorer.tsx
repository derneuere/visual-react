import {
  Card,
  Text,
  Stack,
  Button,
  TextInput,
  Loader,
  Center,
} from "@mantine/core";

import { useQuery } from "@tanstack/react-query";
import { useStorageAdapter } from "../../storage/hooks";

interface AssetExplorerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const AssetExplorer = ({ label, value, onChange }: AssetExplorerProps) => {
  const storage = useStorageAdapter();

  const { data, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: () => storage.listAssets(),
  });

  const assets = data || [];

  return (
    <Card shadow="sm" padding="sm" withBorder>
      <Stack>
        <TextInput
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Text>Images:</Text>
        {isLoading && (
          <Center>
            <Loader color="gray" type="dots" />
          </Center>
        )}
        {assets.map((asset: string) => (
          <Button
            key={asset}
            variant={"outline"}
            color={"gray"}
            onClick={() => {
              onChange(storage.getAssetUrl(asset));
            }}
          >
            {asset.replace("assets/", "")}
          </Button>
        ))}
      </Stack>
    </Card>
  );
};

export default AssetExplorer;
